"use server";

import mongoose from "mongoose";

import Question from "@/database/question.model";
import TagQuestion from "@/database/tag-question.model";
import Tag, { ITagDoc } from "@/database/tag.model";

import action from "../handlers/action";
import handleError from "../handlers/error";
import {
  AskQuestionSchema,
  EditQuestionSchema,
  GetQuestionSchema,
} from "../validations";

export async function createQuestion(
  params: CreateQuestionParams
): Promise<ActionResponse<Question>> {
  const validationResult = await action({
    params,
    schema: AskQuestionSchema,
    authorize: true,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { title, content, tags } = validationResult.params!;
  const userId = validationResult?.session?.user?.id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const [question] = await Question.create(
      [{ title, content, author: userId }],
      {
        session,
      }
    );

    if (!question) {
      throw new Error("Failed to create question.");
    }

    const tagIds: mongoose.Types.ObjectId[] = [];
    const tagQuestionDocuments = [];

    for (const tag of tags) {
      const existingTag = await Tag.findOneAndUpdate(
        // We find that Tag by it's name.
        { name: { $regex: new RegExp(`^${tag}$`, "i") } },

        // If we don't find that tag we create a new one and increase the question counter by 1.
        { $setOnInsert: { name: tag }, $inc: { questions: 1 } },

        { upsert: true, new: true, session }
      );

      // We add that tag by its id.
      tagIds.push(existingTag._id);
      tagQuestionDocuments.push({
        tag: existingTag._id,
        question: question._id,
      });
    }

    await TagQuestion.insertMany(tagQuestionDocuments, { session });

    await Question.findByIdAndUpdate(
      question._id,
      { $push: { tags: { $each: tagIds } } },
      { session }
    );

    await session.commitTransaction();

    return { success: true, data: JSON.parse(JSON.stringify(question)) };
  } catch (error) {
    // await session.abortTransaction();
    return handleError(error) as ErrorResponse;
  } finally {
    session.endSession();
  }
}

export async function editQuestion(
  params: EditQuestionParams
): Promise<ActionResponse<Question>> {
  const validationResult = await action({
    params,
    schema: EditQuestionSchema,
    authorize: true,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { title, content, tags, questionId } = validationResult.params!;
  const userId = validationResult?.session?.user?.id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const question = await Question.findById(questionId).populate("tags");

    if (!question) {
      throw new Error("Error not found");
    }

    if (question.author.toString() !== userId) {
      throw new Error("Unauthorized");
    }

    // Changing the title and the contents.
    if (question.title !== title || question.content !== content) {
      question.title = title; // Question title is equal to the New title.
      question.content = content; // Question content is equal to the New content.
      await question.save({ session }); // Allows to everything only be saved if we fully commit the session.
    }

    const tagsToAdd = tags.filter(
      (tag) => !question.tags.includes(tag.toLowerCase())
    );

    const tagsToRemove = question.tags.filter(
      (tag: ITagDoc) => !tags.includes(tag.name.toLowerCase()) // Here we check if that tag does not include the tag name in lowercase.
    );

    const newTagDocuments = [];

    // Logic to add the new tag.
    if (tagsToAdd.length > 0) {
      // If the tags to add array has more than 1 tag or more than 0 then we want to add a new tag.
      for (const tag of tagsToAdd) {
        const existingTag = await Tag.findOneAndUpdate(
          { name: { $regex: new RegExp(`^${tag}$`, "i") } },
          { $setOnInsert: { name: tag }, $inc: { questions: 1 } },
          { upsert: true, new: true, session }
        );

        if (existingTag) {
          newTagDocuments.push({
            tag: existingTag._id,
            question: questionId,
          });

          question.tags.push(existingTag._id);
        }
      }
    }

    // Logic to remove an existing tag.
    if (tagsToRemove.length > 0) {
      const tagIdsToRemove = tagsToRemove.map((tag: ITagDoc) => tag._id);

      await Tag.updateMany(
        { _id: { $in: tagIdsToRemove } },
        { $inc: { questions: -1 } },
        { session }
      );

      await TagQuestion.deleteMany(
        { tag: { $in: tagIdsToRemove }, question: questionId }, // Here we will delete each tag in the "tagIdsToRemove" array linked to a specific question by it's questionId.
        { session } // Here we stop it from happening in case something goes wrong.
      );

      // Here we want to change the tags belonging to a specific question.
      question.tags = question.tags.filter(
        (tagId: mongoose.Types.ObjectId) => !tagsToRemove.includes(tagId) // Here we check if the "tagstoRemove" includes the specific "tagId"
      );
    }

    if (newTagDocuments.length > 0) {
      await TagQuestion.insertMany(newTagDocuments, { session });
    }

    await question.save({ session });
    await session.commitTransaction();

    return { success: true, data: JSON.parse(JSON.stringify(question)) };
  } catch (error) {
    await session.abortTransaction();
    return handleError(error) as ErrorResponse;
  } finally {
    await session.endSession();
  }
}

export async function getQuestion(
  params: GetQuestionParams
): Promise<ActionResponse<Question>> {
  const validationResult = await action({
    params,
    schema: GetQuestionSchema,
    authorize: true,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  // Here we will get just the questionId.
  const { questionId } = validationResult.params!;

  // Once we get it we will open a new try/catch block.

  try {
    const question = await Question.findById(questionId).populate("tags"); // Here we find our question on the server by its ID and we populate the tags.

    if (!question) {
      throw new Error("Question not Found.");
    }

    return { success: true, data: JSON.parse(JSON.stringify(question)) };
  } catch (error) {
    return handleError(error) as ErrorResponse; // If something goes wrong we simply return our handleError(error) as our ErrorResponse.
  }
}

/*
 Server Actions are designed to be used in different contexts:

 1. In Server Components: They act like regular async functions.
 2. In Client Components: When used in form actions or event handlers, they are invoked via a POST request.

 It's a Direct Invocation. When you use a Server Action in a Server Component, you are directly 
 calling the function on the server. There is no HTTP request involved at all because both the Server Component
 and the Server Action are executing in the same server environment.
*/
