import { redirect } from "next/navigation";
import React from "react";

import { auth } from "@/auth";
import QuestionForm from "@/components/forms/QuestionForm";

const AskAQuestion = async () => {
  // This makes only the user that is Logged in have the authorization to ask a question.
  // If the user is not logged in, then he is redirected by "Next/Navigation" to the "Sign-in" page.
  const session = await auth();
  if (!session) return redirect("/sign-in");

  return (
    <>
      <h1 className="h1-bold text-dark100_light900">Ask a question</h1>

      <div className="mt-9">
        <QuestionForm />
      </div>
    </>
  );
};

export default AskAQuestion;
