import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

beforeEach(() => {
  localStorage.clear()
})

describe('Aegis Atlas app', () => {
  it('renders the command center with mission metrics', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /Disaster Response Command/i })).toBeInTheDocument()
    expect(screen.getByText(/People at risk/i)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /City risk map/i })).toBeInTheDocument()
  })

  it('applies field intel and shifts the hazard mode', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.clear(screen.getByLabelText(/Field intel/i))
    await user.type(screen.getByLabelText(/Field intel/i), 'Wildfire smoke, wind shift, no signal for 9 hours')
    await user.click(screen.getByRole('button', { name: /Apply intel/i }))

    expect(screen.getAllByText(/wildfire/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Fire behavior terms indicate wildfire spread risk/i)).toBeInTheDocument()
  })

  it('opens the markdown export preview', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByTitle(/Export action plan/i))

    expect(screen.getByRole('dialog', { name: /Incident action report/i })).toBeInTheDocument()
    expect(screen.getByDisplayValue(/Aegis Atlas Incident Action Plan/i)).toBeInTheDocument()
  })

  it('starts a JSON download from the export button', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    render(<App />)

    await user.click(screen.getByTitle(/Export JSON/i))

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()

    createObjectURL.mockRestore()
    revokeObjectURL.mockRestore()
    click.mockRestore()
  })
})
