import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import Login from './Login';
import {signInWithCustomToken} from 'firebase/auth';

const mockNavigate = jest.fn();
const password = 'a strong fixture password';

function submitInvitation() {
  fireEvent.change(screen.getByLabelText('Create a password'), {target: {value: password}});
  fireEvent.change(screen.getByLabelText('Confirm password'), {target: {value: password}});
  fireEvent.click(screen.getByRole('button', {name: 'Save password and sign in'}));
}
jest.mock('react-router-dom', () => ({useNavigate: () => mockNavigate}), {virtual: true});
jest.mock('../utils/AuthContext', () => ({useAuth: () => ({login: jest.fn(), currentUser: null, userRole: null})}));
jest.mock('../config/firebase', () => ({auth: {}}));
jest.mock('firebase/auth', () => ({signInWithCustomToken: jest.fn()}));

beforeEach(() => {
  jest.clearAllMocks();
  window.history.replaceState(null, '', '/login#invite=' + 'a'.repeat(64));
});

test('invitation is removed from URL and redeemed only on explicit acceptance', async () => {
  global.fetch = jest.fn().mockResolvedValue({ok: true, json: async () => ({token: 'custom-token'})});
  signInWithCustomToken.mockResolvedValue({});
  render(<Login />);
  expect(window.location.hash).toBe('');
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.getByRole('heading', {name: 'Set your manager password'})).toBeInTheDocument();
  expect(screen.queryByLabelText('Email Address')).not.toBeInTheDocument();
  submitInvitation();
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/manager', {replace: true}));
  expect(fetch).toHaveBeenCalledWith('/api/manager-invitation', expect.objectContaining({method: 'POST', body: JSON.stringify({invite: 'a'.repeat(64), password})}));
  expect(signInWithCustomToken).toHaveBeenCalledWith({}, 'custom-token');
});

test('expired invitations display the API error without signing in', async () => {
  global.fetch = jest.fn().mockResolvedValue({ok: false, json: async () => ({error: 'Invitation expired'})});
  render(<Login />);
  submitInvitation();
  await screen.findByText('Invitation expired');
  expect(signInWithCustomToken).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
});
