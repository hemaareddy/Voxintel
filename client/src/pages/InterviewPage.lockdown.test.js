/**
 * Tests the anti-cheating "lockdown" behavior: after the candidate enters
 * the interview, a tab/window switch (or exiting fullscreen) is detected via
 * window blur / visibilitychange / fullscreenchange. The first violation
 * shows a warning; a second ends the session immediately and redirects to
 * results with a `terminatedReason` flag.
 */
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
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
    { index: 0, question: "Explain closures.", category: "Frontend Development", difficulty: "medium", source: "dataset" },
  ],
};

function ResultsStub() {
  const location = useLocation();
  return <div data-testid="results-stub">{location.state?.terminatedReason || "none"}</div>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/interview", state: { session } }]}>
      <Routes>
        <Route path="/interview" element={<InterviewPage />} />
        <Route path="/results" element={<ResultsStub />} />
      </Routes>
    </MemoryRouter>
  );
}

async function beginInterview() {
  fireEvent.click(screen.getByRole("button", { name: /enter fullscreen.*start interview/i }));
  await screen.findByText(/question 1 of/i);
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

test("switching away from the tab shows a warning without ending the session", async () => {
  renderPage();
  await beginInterview();

  act(() => {
    window.dispatchEvent(new Event("blur"));
  });

  expect(await screen.findByText(/warning: you left the interview/i)).toBeInTheDocument();
  expect(interviewAPI.complete).not.toHaveBeenCalled();
});

test("dismissing the warning hides it and the interview continues normally", async () => {
  renderPage();
  await beginInterview();

  act(() => {
    window.dispatchEvent(new Event("blur"));
  });
  await screen.findByText(/warning: you left the interview/i);

  fireEvent.click(screen.getByRole("button", { name: /i understand, continue/i }));

  expect(screen.queryByText(/warning: you left the interview/i)).not.toBeInTheDocument();
  expect(screen.getByText(/question 1 of/i)).toBeInTheDocument();
});

test("exiting fullscreen also counts as a violation", async () => {
  renderPage();
  await beginInterview();

  act(() => {
    document.dispatchEvent(new Event("fullscreenchange"));
  });

  expect(await screen.findByText(/warning: you left the interview/i)).toBeInTheDocument();
});

test("near-simultaneous blur + fullscreenchange from the same departure count as one violation", async () => {
  renderPage();
  await beginInterview();

  act(() => {
    window.dispatchEvent(new Event("blur"));
    document.dispatchEvent(new Event("fullscreenchange"));
  });
  await screen.findByText(/warning: you left the interview/i);

  fireEvent.click(screen.getByRole("button", { name: /i understand, continue/i }));

  // If both events had counted separately, this would already be the 2nd+3rd
  // violation and the session would have ended.
  expect(interviewAPI.complete).not.toHaveBeenCalled();
  expect(screen.getByText(/question 1 of/i)).toBeInTheDocument();
});

test("a second violation ends the session immediately and redirects to results", async () => {
  interviewAPI.complete.mockResolvedValue({ data: { summary: { averageOverallScore: 40 } } });

  renderPage();
  await beginInterview();

  act(() => {
    window.dispatchEvent(new Event("blur"));
  });
  await screen.findByText(/warning: you left the interview/i);
  fireEvent.click(screen.getByRole("button", { name: /i understand, continue/i }));

  // Advance past the debounce window so this doesn't coalesce with the first violation.
  act(() => {
    jest.advanceTimersByTime(2000);
  });

  await act(async () => {
    window.dispatchEvent(new Event("blur"));
  });

  expect(await screen.findByTestId("results-stub")).toHaveTextContent("tab-switch");
  expect(interviewAPI.complete).toHaveBeenCalledWith("session1");
});

test("no violation listeners are attached before the candidate clicks begin", () => {
  renderPage();

  act(() => {
    window.dispatchEvent(new Event("blur"));
  });

  expect(screen.queryByText(/warning: you left the interview/i)).not.toBeInTheDocument();
});
