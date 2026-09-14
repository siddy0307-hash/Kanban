import { render, screen } from '@testing-library/react';
import axios from 'axios';
import App from './App';

jest.mock('axios', () => ({
  get: jest.fn(),
}));

test('renders the Kanban board after loading data', async () => {
  axios.get.mockResolvedValue({
    data: {
      tickets: [],
      users: [],
    },
  });

  render(<App />);

  expect(screen.getByText(/loading/i)).toBeInTheDocument();
  expect(
    await screen.findByRole('heading', { name: /kanban board/i })
  ).toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith(
    'https://api.quicksell.co/v1/internal/frontend-assignment'
  );
});
