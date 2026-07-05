/**
 * Smoke test — confirms the app shell renders without crashing.
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./utils/AuthContext";

test("renders the login page without crashing", async () => {
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );

  expect(
    await screen.findByRole("heading", { name: /sign in to your account/i })
  ).toBeInTheDocument();
});
