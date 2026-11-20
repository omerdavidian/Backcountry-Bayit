import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import Login from './Login';
import {signInWithCustomToken} from 'firebase/auth';

const mockNavigate = jest.fn();
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
  fireEvent.click(screen.getByRole('button', {name: 'Accept invitation and sign in'}));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/manager', {replace: true}));
  expect(fetch).toHaveBeenCalledWith('/api/manager-invitation', expect.objectContaining({method: 'POST', body: JSON.stringify({invite: 'a'.repeat(64)})}));
  expect(signInWithCustomToken).toHaveBeenCalledWith({}, 'custom-token');
});

test('expired invitations display the API error without signing in', async () => {
  global.fetch = jest.fn().mockResolvedValue({ok: false, json: async () => ({error: 'Invitation expired'})});
  render(<Login />);
  fireEvent.click(screen.getByRole('button', {name: 'Accept invitation and sign in'}));
  await screen.findByText('Invitation expired');
  expect(signInWithCustomToken).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
});
