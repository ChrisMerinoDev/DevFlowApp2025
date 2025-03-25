/* We're creating a new getTags action or async function
 that accepts a single "params" object called "params" which will contain information about the:
 page, pageSize, query, filter, sort, etc. 
 To make our typescript "happy" and our code "bug-free", we are specifying exactly what the function is returning
 So since for the params you are defining what they look like, now you are defining
 what the function will return.
 So the function will return a Promise which is a type of ActionResponse which we created before, which will contain
 information about the tags and also the "isNext" property which contains info about the pagination.
 
*/

import { FilterQuery } from "mongoose";

import { Tag } from "@/database";

import action from "../handlers/action";
import handleError from "../handlers/error";
import { PaginatedSearchParamsSchema } from "../validations";

export const getTags = async (
  params: PaginatedSearchParams
): Promise<ActionResponse<{ tags: Tag[]; isNext: boolean }>> => {
  // Within this function we first want to validate the "params" we are passing in.
  const validationResult = await action({
    params,
    schema: PaginatedSearchParamsSchema,
  });

  // Once we get the "validationResult" let's check if it's correct or corrupt by doing an if statement.
  // One for if the validation is an instace of error, and one if it is validated.
  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  // If the it is correct we can de-structure those params.
  const { page = 1, pageSize = 10, query, filter } = params;

  // Some Pagination and Filtering features logic being applied.
  const skip = (Number(page) - 1) * pageSize;
  const limit = Number(pageSize);

  const filterQuery: FilterQuery<typeof Tag> = {};

  // We can check if there is a specific Query by doing this below.
  if (query) {
    filterQuery.$or = [
      {
        // Here we are looking at the name of the Tag.
        name: {
          $regex: query,
          $options: "i", // with the options of "i" for case insensitive.
        },
      },
    ];
  }
  // We can also look at the "Sorting" criteria.
  let sortCriteria = {};

  // Then we can do the filters.

  switch (filter) {
    case "popular":
      sortCriteria = { questions: -1 }; // The number of questions that is tied to this tags.
      break;

    case "recent":
      sortCriteria = { createdAt: -1 };
      break;

    case "oldest":
      sortCriteria = { createdAt: 1 };
      break;

    case "name":
      sortCriteria = { name: 1 };
      break;

    default:
      sortCriteria = { questions: -1 };
      break;
  }

  // Now we can open a try-catch block to fetch some of these tags.
  try {
    // First we can fetch the total number of tags.
    const totalTags = await Tag.countDocuments(filterQuery); // We are passing the filterQuery based on which filter we want to retrieve the tags from.

    const tags = await Tag.find(filterQuery)
      .sort(sortCriteria)
      .skip(skip)
      .limit(limit);
    // Here we will figure out if there is more tags on the next page.
    // Here is the logic to find out.
    const isNext = totalTags > skip + tags.length;

    return {
      // Here we are returning our action response that we've created and returning it when the function is succesffully executed.
      // So we pass those properties how we want to show them.
      success: true,
      data: { tags: JSON.parse(JSON.stringify(tags)), isNext },
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
};
