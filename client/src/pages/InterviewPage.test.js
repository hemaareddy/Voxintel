/**
 * Tests the adaptive follow-up flow: after submitting a primary answer that
 * returns a followUpQuestion, the follow-up must be shown and "Next Question"
 * must be blocked until the follow-up is answered (or skipped).
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import InterviewPage from "./InterviewPage";
import { interviewAPI } from "../utils/api";

jest.mock("../utils/api", () => ({
  interviewAPI: {
    submitAnswer: jest.fn(),
    complete: jest.fn(),
  },
}));

const session = {
  sessionId: "session1",
  config: { role: "Backend Developer", company: "General", difficulty: "medium" },
  questions: [
    {
      index: 0,
      questionId: "q0",
      question: "Explain closures.",
      category: "Frontend Development",
      difficulty: "medium",
      source: "resume",
      followUpQuestions: [],
    },
    {
      index: 1,
      questionId: "q1",
      question: "Explain the event loop.",
      category: "Frontend Development",
      difficulty: "medium",
      source: "dataset",
      followUpQuestions: [],
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/interview", state: { session } }]}>
      <InterviewPage />
    </MemoryRouter>
  );
}

// The interview is gated behind a "Ready to begin?" screen (entering
// fullscreen needs a user gesture) — every test must click through it first.
async function beginInterview() {
  fireEvent.click(screen.getByRole("button", { name: /enter fullscreen.*start interview/i }));
  await screen.findByText(/question 1 of/i);
}

afterEach(() => {
  jest.clearAllMocks();
});

test("shows a gate screen before the interview starts", () => {
  renderPage();
  expect(screen.getByRole("heading", { name: /ready to begin/i })).toBeInTheDocument();
  expect(screen.queryByText(/question 1 of/i)).not.toBeInTheDocument();
});

test("shows the adaptive follow-up after answering, and blocks Next until it's resolved", async () => {
  interviewAPI.submitAnswer
    .mockResolvedValueOnce({
      data: {
        scores: { overall: 70, semantic: 70, keyword: 70, completeness: 70 },
        feedback: "Good job.",
        followUpQuestion: 'You mentioned "closures" — can you go deeper?',
      },
    })
    .mockResolvedValueOnce({
      data: { scores: { overall: 90 }, feedback: "Great depth." },
    });

  renderPage();
  await beginInterview();

  fireEvent.change(screen.getByPlaceholderText(/type your answer here/i), {
    target: { value: "Closures keep a reference to their lexical scope." },
  });
  fireEvent.click(screen.getByRole("button", { name: /submit answer/i }));

  expect(await screen.findByText(/follow-up question/i)).toBeInTheDocument();
  expect(screen.getByText(/you mentioned "closures"/i)).toBeInTheDocument();

  // Next Question must not be available while the follow-up is unresolved
  expect(screen.queryByRole("button", { name: /next question/i })).not.toBeInTheDocument();

  fireEvent.change(screen.getByPlaceholderText(/answer the follow-up/i), {
    target: { value: "More detail about closures and scope chains." },
  });
  fireEvent.click(screen.getByRole("button", { name: /submit follow-up/i }));

  expect(await screen.findByText(/follow-up evaluation/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /next question/i })).toBeInTheDocument();

  expect(interviewAPI.submitAnswer).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ isFollowUp: true, userAnswer: "More detail about closures and scope chains." })
  );
});

test("skipping the follow-up unblocks Next Question without a second API call", async () => {
  interviewAPI.submitAnswer.mockResolvedValueOnce({
    data: {
      scores: { overall: 70, semantic: 70, keyword: 70, completeness: 70 },
      feedback: "Good job.",
      followUpQuestion: "Can you elaborate?",
    },
  });

  renderPage();
  await beginInterview();

  fireEvent.change(screen.getByPlaceholderText(/type your answer here/i), {
    target: { value: "An answer." },
  });
  fireEvent.click(screen.getByRole("button", { name: /submit answer/i }));

  expect(await screen.findByText(/follow-up question/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /skip/i }));

  expect(await screen.findByRole("button", { name: /next question/i })).toBeInTheDocument();
  expect(interviewAPI.submitAnswer).toHaveBeenCalledTimes(1);
});

test("no follow-up question means Next Question is available immediately", async () => {
  interviewAPI.submitAnswer.mockResolvedValueOnce({
    data: {
      scores: { overall: 70, semantic: 70, keyword: 70, completeness: 70 },
      feedback: "Good job.",
      followUpQuestion: null,
    },
  });

  renderPage();
  await beginInterview();

  fireEvent.change(screen.getByPlaceholderText(/type your answer here/i), {
    target: { value: "An answer." },
  });
  fireEvent.click(screen.getByRole("button", { name: /submit answer/i }));

  expect(await screen.findByRole("button", { name: /next question/i })).toBeInTheDocument();
  expect(screen.queryByText(/follow-up question/i)).not.toBeInTheDocument();
});
