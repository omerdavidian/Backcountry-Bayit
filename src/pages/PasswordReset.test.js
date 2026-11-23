import React from "react";
import {render, screen, fireEvent, waitFor} from "@testing-library/react";
import {confirmPasswordReset, signOut, verifyPasswordResetCode} from "firebase/auth";
import PasswordReset from "./PasswordReset";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({Link: "a", useNavigate: () => mockNavigate}), {virtual: true});

jest.mock("../config/firebase", () => ({auth: {}}));
jest.mock("firebase/auth", () => ({
  verifyPasswordResetCode: jest.fn(), confirmPasswordReset: jest.fn(), signOut: jest.fn(),
}));

function openLink() {
  window.history.replaceState(null, "", "/reset-password#oobCode=fixture");
  return render(<PasswordReset />);
}

beforeEach(() => jest.resetAllMocks());

test("uses the verified email as the username and sends the user to login after saving", async () => {
  verifyPasswordResetCode.mockResolvedValue("manager@example.test");
  confirmPasswordReset.mockResolvedValue();
  signOut.mockResolvedValue();
  openLink();

  const email = await screen.findByLabelText("Email address");
  expect(email).toHaveValue("manager@example.test");
  expect(email).toHaveAttribute("autocomplete", "username");
  const password = screen.getByLabelText("New password", {exact: true});
  expect(password).toHaveAttribute("autocomplete", "new-password");
  fireEvent.change(password, {target: {value: "fixture password"}});
  fireEvent.change(screen.getByLabelText("Confirm new password"), {target: {value: "fixture password"}});
  fireEvent.click(screen.getByRole("button", {name: "Save new password"}));

  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/login", {replace: true, state: {email: "manager@example.test", passwordChanged: true}}));
  expect(confirmPasswordReset).toHaveBeenCalledWith({}, "fixture", "fixture password");
  expect(signOut).toHaveBeenCalled();
});

test("expired links do not show a password form", async () => {
  verifyPasswordResetCode.mockRejectedValue(new Error("Expired"));
  openLink();
  expect(await screen.findByRole("alert")).toHaveTextContent("expired");
  expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
});
