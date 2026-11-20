import React from 'react';
import {render, screen, fireEvent, within, waitFor} from '@testing-library/react';
import Admin from './Admin';
import {useAuth} from '../utils/AuthContext';
import {getDocs} from 'firebase/firestore';
import {authorizedFetch} from '../utils/apiClient';

jest.mock('react-router-dom', () => ({useNavigate: () => jest.fn(), useLocation: () => ({})}), {virtual: true});
jest.mock('../utils/AuthContext', () => ({useAuth: jest.fn()}));
jest.mock('../config/firebase', () => ({db: {}, auth: {}}));
jest.mock('firebase/firestore', () => ({collection: (_db, name) => name, getDocs: jest.fn(), doc: jest.fn(), updateDoc: jest.fn(), deleteDoc: jest.fn()}));
jest.mock('../utils/apiClient', () => ({authorizedFetch: jest.fn()}));
jest.mock('../components/EventFormFields', () => () => null);
jest.mock('../components/EmailRSVPsModal', () => () => null);

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  useAuth.mockReturnValue({currentUser: {email: 'admin@example.com'}, isManager: true, isAdmin: true});
  global.fetch = jest.fn().mockResolvedValue({ok: true, json: async () => ({events: []})});
  getDocs.mockResolvedValue({docs: []});
  authorizedFetch.mockResolvedValue({ok: true, json: async () => ({users: []})});
});

test('past events collapse, sort newest first, paginate by button and scroll, and reset on reopen', async () => {
  const events = Array.from({length: 23}, (_, i) => ({id: `past-${i}`, title: `Past ${i}`, date: `2020-01-${String(i + 1).padStart(2, '0')}`, time: '6:30 PM'}));
  events.push({id: 'future', title: 'Future hike', date: '2099-01-01'});
  getDocs.mockImplementation(async name => ({docs: name === 'events' ? events.map(event => ({id: event.id, data: () => event})) : []}));
  render(<Admin />);
  const toggle = await screen.findByRole('button', {name: /Past Events \(23\)/});
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByText('Upcoming Events (1)')).toBeInTheDocument();
  fireEvent.click(toggle);
  const archive = screen.getByRole('region', {name: 'Past events'});
  expect(within(archive).getAllByRole('row')).toHaveLength(11);
  expect(within(archive).getAllByRole('row')[1]).toHaveTextContent('Past 22');
  expect(within(archive).queryByText('Future hike')).not.toBeInTheDocument();
  fireEvent.click(within(archive).getByRole('button', {name: 'Show 10 more'}));
  expect(within(archive).getAllByRole('row')).toHaveLength(21);
  fireEvent.scroll(archive);
  expect(within(archive).getAllByRole('row')).toHaveLength(24);
  expect(within(archive).queryByText('Show 10 more')).not.toBeInTheDocument();
  fireEvent.click(toggle);
  expect(archive).not.toBeVisible();
  fireEvent.click(toggle);
  expect(within(archive).getAllByRole('row')).toHaveLength(11);
});

test('same-day archive events sort by actual time descending', async () => {
  const events = ['9:00 AM', '12:00 PM', '6:30 PM'].map((time, i) => ({id: String(i), title: time, date: '2020-01-01', time}));
  getDocs.mockImplementation(async name => ({docs: name === 'events' ? events.map(event => ({id: event.id, data: () => event})) : []}));
  render(<Admin />);
  fireEvent.click(await screen.findByRole('button', {name: /Past Events \(3\)/}));
  const rows = within(screen.getByRole('region', {name: 'Past events'})).getAllByRole('row');
  expect(rows[1].cells[0]).toHaveTextContent('6:30 PM');
  expect(rows[2].cells[0]).toHaveTextContent('12:00 PM');
  expect(rows[3].cells[0]).toHaveTextContent('9:00 AM');
});

test.each([true, false])('invitation controls respect admin permission (%s)', async isAdmin => {
  useAuth.mockReturnValue({currentUser: {email: 'admin@example.com'}, isManager: true, isAdmin});
  authorizedFetch.mockResolvedValue({ok: true, json: async () => ({users: [
    {uid: 'manager', email: 'manager@example.com', managerEligible: true, invitationStatus: 'Pending', metadata: {}},
    {uid: 'regular', email: 'regular@example.com', managerEligible: false, metadata: {}}
  ]})});
  render(<Admin />);
  if (!isAdmin) {
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
    expect(authorizedFetch).not.toHaveBeenCalledWith('/api/list-users');
    return;
  }
  fireEvent.click(screen.getByText('Users'));
  await screen.findByText('manager@example.com');
  expect(within(screen.getByRole('table')).getByText('Pending')).toBeInTheDocument();
  expect(screen.queryAllByRole('button', {name: 'Resend Invitation'})).toHaveLength(isAdmin ? 1 : 0);
  fireEvent.click(screen.getByRole('button', {name: 'Resend Invitation'}));
  await screen.findByText('Invitation sent.');
  expect(authorizedFetch).toHaveBeenCalledWith('/api/manager-invitation', expect.objectContaining({method: 'POST', body: JSON.stringify({uid: 'manager'})}));
  await waitFor(() => expect(screen.getByRole('button', {name: 'Resend Invitation'})).toBeEnabled());
});

test('an empty archive opens and closes with an empty-state message', async () => {
  render(<Admin />);
  const toggle = screen.getByRole('button', {name: /Past Events \(0\)/});
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  fireEvent.click(toggle);
  expect(screen.getByText('No past events.')).toBeVisible();
  fireEvent.click(toggle);
  expect(screen.getByText('No past events.')).not.toBeVisible();
});

test('resending disables the button while pending and surfaces delivery errors', async () => {
  const user = {uid: 'manager', email: 'manager@example.com', managerEligible: true, invitationStatus: 'Failed', metadata: {}};
  let finishSend;
  authorizedFetch.mockImplementation(url => url === '/api/list-users'
    ? Promise.resolve({ok: true, json: async () => ({users: [user]})})
    : new Promise(resolve => {finishSend = resolve;}));
  render(<Admin />);
  fireEvent.click(screen.getByText('Users'));
  fireEvent.click(await screen.findByRole('button', {name: 'Resend Invitation'}));
  expect(screen.getByRole('button', {name: 'Sending…'})).toBeDisabled();
  finishSend({ok: false, json: async () => ({error: 'Invitation delivery failed. Please try again.'})});
  await screen.findByText('Invitation delivery failed. Please try again.');
  await waitFor(() => expect(screen.getByRole('button', {name: 'Resend Invitation'})).toBeEnabled());
});

test('user search and invitation filters work together', async () => {
  const metadata = {};
  authorizedFetch.mockResolvedValue({ok: true, json: async () => ({users: [
    {uid: 'one', displayName: 'First Manager', email: 'first@example.com', managerEligible: true, invitationStatus: 'Pending', metadata},
    {uid: 'two', displayName: 'Second Manager', email: 'second@example.com', managerEligible: true, invitationStatus: 'Accepted', metadata}
  ]})});
  render(<Admin />);
  fireEvent.click(screen.getByText('Users'));
  await screen.findByText('First Manager');
  fireEvent.change(screen.getByRole('combobox', {name: 'Invitation status'}), {target: {value: 'Pending'}});
  expect(screen.queryByText('Second Manager')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox', {name: 'Search users'}), {target: {value: 'second@example.com'}});
  expect(screen.getByText('No users match your filters.')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', {name: 'Invitation status'}), {target: {value: ''}});
  expect(screen.getByText('Second Manager')).toBeInTheDocument();
});

test('manager dashboard uses the shared events view and greets the account by name', async () => {
  useAuth.mockReturnValue({currentUser: {email: 'manager@example.com', displayName: 'Jordan Smith'}, isManager: true, isAdmin: false});
  sessionStorage.setItem('adminActiveTab', 'users');
  render(<Admin managerView />);
  expect(screen.getByRole('heading', {name: 'Manager Dashboard'})).toBeInTheDocument();
  expect(screen.getByText('Welcome, Jordan Smith')).toBeInTheDocument();
  expect(screen.getByRole('searchbox', {name: 'Search upcoming and past events'})).toBeInTheDocument();
  expect(await screen.findByRole('button', {name: /Past Events/})).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByText('Users')).not.toBeInTheDocument();
});
