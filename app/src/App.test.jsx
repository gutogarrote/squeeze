import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import App from './App';
import { KEYS } from './lib/storage';

vi.mock('./components/PwaUpdateNotice', () => ({ default: () => null }));

// jsdom has no PointerEvent: without it, clientX would be lost in fireEvent.pointer*.
if (!window.PointerEvent) {
  window.PointerEvent = class PointerEvent extends MouseEvent {
    constructor(type, init = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; }
  };
}

const local = (h, m = 0) => new Date(2026, 10, 4, h, m).getTime();
let nowMs;
const clock = () => nowMs;
const MIN = 60000;

function advance(ms) {
  nowMs += ms;
  act(() => { vi.advanceTimersByTime(1000); });
}

function swipe(element, dx) {
  fireEvent.pointerDown(element, { clientX: 200, clientY: 10, pointerId: 1, button: 0 });
  fireEvent.pointerMove(element, { clientX: 200 + dx / 2, clientY: 10, pointerId: 1 });
  fireEvent.pointerMove(element, { clientX: 200 + dx, clientY: 10, pointerId: 1 });
  fireEvent.pointerUp(element, { clientX: 200 + dx, clientY: 10, pointerId: 1 });
}
const card = (name) => screen.getByRole('group', { name });
const taskNames = () => within(screen.getByRole('list', { name: 'Tarefas' })).getAllByRole('group').map((g) => g.getAttribute('aria-label'));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  nowMs = local(12, 20);
});
afterEach(() => { vi.useRealTimers(); });

function startExample() {
  render(<App home="plan" clock={clock} />);
  fireEvent.click(screen.getByRole('button', { name: 'Começar' }));
}

describe('planning', () => {
  test('fixed and buffer selectors are exclusive, allow multiple fixed tasks and only one buffer', () => {
    render(<App home="plan" clock={clock} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Fixo: Orçamento' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Fixo: Guardar equipamentos' }));
    expect(screen.getByRole('checkbox', { name: 'Fixo: Orçamento' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Fixo: Guardar equipamentos' })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Folga: Orçamento' }));
    expect(screen.getByRole('checkbox', { name: 'Fixo: Orçamento' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Folga: Almoço' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar tarefa' }));
    expect(screen.getByRole('checkbox', { name: 'Folga: tarefa 6' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Remover Orçamento' }));
    expect(screen.getByRole('checkbox', { name: 'Folga: Almoço' })).toBeEnabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Folga: Almoço' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rotina' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rotinas', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Tarde' }));
    expect(screen.getByRole('checkbox', { name: 'Fixo: Guardar equipamentos' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Folga: Almoço' })).toBeChecked();
  });

  test('fixed tasks and a single buffer survive running, reload, editing and restarting', () => {
    localStorage.setItem(KEYS.draft, JSON.stringify({ name: 'Tipos', deadline: '13:30', tasks: [
      { id: 'a', name: 'A', minutes: 10 }, { id: 'f', name: 'Fixa', minutes: 20, type: 'fixed' },
      { id: 'b', name: 'B', minutes: 30 }, { id: 'r', name: 'Reserva', minutes: 10, type: 'buffer' },
    ] }));
    const { unmount } = render(<App home="plan" clock={clock} />);
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }));
    advance(25 * MIN);
    expect(card('Próxima: Fixa')).toHaveTextContent('20 min');
    expect(card('Próxima: B')).toHaveTextContent('25 min');
    expect(card('Reserva')).toHaveTextContent('0 min');
    expect(screen.queryByRole('group', { name: 'Folga', exact: true })).not.toBeInTheDocument();
    unmount();
    render(<App home="plan" clock={clock} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    const dialog = screen.getByRole('dialog', { name: 'Editar rotina' });
    expect(within(dialog).getByRole('checkbox', { name: 'Fixo: Fixa' })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'Folga: B' })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Fixo: B' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar', exact: true }));
    expect(card('Próxima: B')).toHaveTextContent('30 min');
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Recomeçar com novo deadline' }));
    expect(screen.getByRole('checkbox', { name: 'Fixo: Fixa' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Fixo: B' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Folga: Reserva' })).toBeChecked();
  });

  test('saved routines move up and down, keep their content and preserve their order after reload', () => {
    const templates = ['Manhã', 'Tarde', 'Noite'].map((name, i) => ({
      id: `saved-${i}`, name, deadline: '20:30', templateId: null,
      tasks: [{ id: `task-${i}`, name: `Tarefa ${i}`, minutes: 10 }],
    }));
    localStorage.setItem(KEYS.templates, JSON.stringify(templates));
    const { unmount } = render(<App home="plan" clock={clock} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rotinas', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Tarde' }));
    fireEvent.change(screen.getByLabelText('Nome da tarefa 1'), { target: { value: 'Edição pendente' } });
    const draft = localStorage.getItem(KEYS.draft);
    fireEvent.click(screen.getByRole('button', { name: 'Rotinas', exact: true }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Ordenar rotinas' }), { target: { value: 'manual' } });
    const names = () => within(screen.getByRole('list', { name: 'Rotinas salvas' }))
      .getAllByRole('button', { name: /^Abrir / }).map((b) => b.getAttribute('aria-label'));
    expect(screen.getByRole('button', { name: 'Subir rotina Manhã' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descer rotina Noite' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Subir rotina Tarde' }));
    expect(names()).toEqual(['Abrir Tarde', 'Abrir Manhã', 'Abrir Noite']);
    fireEvent.click(screen.getByRole('button', { name: 'Descer rotina Manhã' }));
    expect(names()).toEqual(['Abrir Tarde', 'Abrir Noite', 'Abrir Manhã']);
    expect(JSON.parse(localStorage.getItem(KEYS.templates))).toEqual([templates[1], templates[2], templates[0]]);
    expect(localStorage.getItem(KEYS.draft)).toBe(draft);
    unmount();
    render(<App home="plan" clock={clock} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rotinas', exact: true }));
    expect(names()).toEqual(['Abrir Tarde', 'Abrir Noite', 'Abrir Manhã']);
    fireEvent.click(screen.getByRole('button', { name: /^Continuar editando/ }));
    expect(screen.getByLabelText('Nome da tarefa 1')).toHaveValue('Edição pendente');
  });

  test('routines with identical names are moved by identity and a single routine cannot move', () => {
    const templates = [10, 20].map((minutes) => ({
      id: `saved-${minutes}`, name: 'Mesmo nome', deadline: '20:30', templateId: null,
      tasks: [{ id: `task-${minutes}`, name: 'Ler', minutes }],
    }));
    localStorage.setItem(KEYS.templates, JSON.stringify(templates));
    render(<App home="plan" clock={clock} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rotinas', exact: true }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Ordenar rotinas' }), { target: { value: 'manual' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Descer rotina Mesmo nome' })[0]);
    expect(JSON.parse(localStorage.getItem(KEYS.templates))).toEqual([templates[1], templates[0]]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Excluir Mesmo nome' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir', exact: true }));
    expect(screen.getByRole('button', { name: 'Subir rotina Mesmo nome' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descer rotina Mesmo nome' })).toBeDisabled();
  });

  test('shows the ideal start, the total and the buffer of starting now', () => {
    render(<App home="plan" clock={clock} />);
    expect(screen.getByTestId('ideal-start')).toHaveTextContent('12:35');
    expect(screen.getByText('2h 25')).toBeInTheDocument();
    expect(screen.getByText(/\+15 min de folga/)).toBeInTheDocument();
  });

  test('when the ideal start passed it shows the delay and the compression', () => {
    nowMs = local(13, 0);
    render(<App home="plan" clock={clock} />);
    expect(screen.getByText('Deveria ter começado às')).toBeInTheDocument();
    expect(screen.getByText(/Atrasado 25 min/)).toHaveTextContent('as tarefas ficam com 82% da estimativa');
  });

  test('editing tasks and deadline recalculates the ideal start and persists the draft', () => {
    render(<App home="plan" clock={clock} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mais minutos em Orçamento' }));
    expect(screen.getByTestId('ideal-start')).toHaveTextContent('12:30');
    fireEvent.change(screen.getByLabelText('Deadline'), { target: { value: '16:00' } });
    expect(screen.getByTestId('ideal-start')).toHaveTextContent('13:30');
    fireEvent.click(screen.getByRole('button', { name: 'Remover Almoço' }));
    expect(screen.getByTestId('ideal-start')).toHaveTextContent('13:50');
    const saved = JSON.parse(localStorage.getItem(KEYS.draft));
    expect(saved.deadline).toBe('16:00');
    expect(saved.tasks.map((t) => t.name)).not.toContain('Almoço');
  });

  test('saved routines can be opened again', () => {
    render(<App home="plan" clock={clock} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rotina' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rotinas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nova rotina' }));
    expect(screen.queryByDisplayValue('Orçamento')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rotinas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Tarde' }));
    expect(screen.getByDisplayValue('Orçamento')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeInTheDocument();
  });

  test('the editable deadline follows all tasks in the planner', () => {
    render(<App home="plan" clock={clock} />);
    expect(screen.getByRole('button', { name: '+ Adicionar tarefa' }).compareDocumentPosition(screen.getByLabelText('Deadline')))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  test('save as asks for a name and preserves the original routine', () => {
    const { unmount } = render(<App home="plan" clock={clock} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rotina' }));
    const [original] = JSON.parse(localStorage.getItem(KEYS.templates));
    fireEvent.change(screen.getByLabelText('Nome da tarefa 1'), { target: { value: 'Novo orçamento' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar como…' }));
    const dialog = screen.getByRole('dialog', { name: 'Salvar como' });
    const name = within(dialog).getByRole('textbox', { name: 'Nome da rotina' });
    expect(name).toHaveFocus();
    fireEvent.change(name, { target: { value: '  Tarde de sexta  ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar nova rotina' }));
    const templates = JSON.parse(localStorage.getItem(KEYS.templates));
    expect(templates).toHaveLength(2);
    expect(templates[0]).toEqual(original);
    expect(templates[1].id).not.toBe(original.id);
    expect(templates[1].name).toBe('Tarde de sexta');
    expect(templates[1].tasks[0].name).toBe('Novo orçamento');
    expect(JSON.parse(localStorage.getItem(KEYS.draft)).templateId).toBe(templates[1].id);
    unmount();
    render(<App home="plan" clock={clock} />);
    expect(screen.getByLabelText('Nome da rotina')).toHaveValue('Tarde de sexta');
    fireEvent.click(screen.getByRole('button', { name: 'Rotinas' }));
    expect(screen.getByRole('button', { name: 'Abrir Tarde' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir Tarde de sexta' })).toBeInTheDocument();
  });

  test('save as rejects a blank name and cancel leaves the routines unchanged', async () => {
    render(<App home="plan" clock={clock} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rotina' }));
    const original = localStorage.getItem(KEYS.templates);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar como…' }));
    const dialog = screen.getByRole('dialog', { name: 'Salvar como' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Nome da rotina' }), { target: { value: '   ' } });
    expect(within(dialog).getByRole('button', { name: 'Salvar nova rotina' })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem(KEYS.templates)).toBe(original);
    expect(screen.getByLabelText('Nome da rotina')).toHaveValue('Tarde');
    expect(screen.getByRole('button', { name: 'Salvar como…' })).toHaveFocus();
  });

  test('renaming a saved routine preserves its identity and does not save pending task edits', () => {
    const { unmount } = render(<App home="plan" clock={clock} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rotina' }));
    const [original] = JSON.parse(localStorage.getItem(KEYS.templates));
    fireEvent.change(screen.getByLabelText('Nome da tarefa 1'), { target: { value: 'Rascunho pendente' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rotinas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Renomear Tarde' }));
    const dialog = screen.getByRole('dialog', { name: 'Renomear rotina' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Nome da rotina' }), { target: { value: '  Trabalho  ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Renomear' }));
    expect(screen.getByRole('button', { name: 'Abrir Trabalho' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(KEYS.templates))).toEqual([{ ...original, name: 'Trabalho' }]);
    fireEvent.click(screen.getByRole('button', { name: /^Continuar editando/ }));
    expect(screen.getByLabelText('Nome da rotina')).toHaveValue('Trabalho');
    expect(screen.getByLabelText('Nome da tarefa 1')).toHaveValue('Rascunho pendente');
    unmount();
    render(<App home="plan" clock={clock} />);
    expect(screen.getByLabelText('Nome da rotina')).toHaveValue('Trabalho');
    fireEvent.click(screen.getByRole('button', { name: 'Rotinas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Trabalho' }));
    expect(screen.getByLabelText('Nome da tarefa 1')).toHaveValue('Orçamento');
  });

  test('renaming another saved routine and cancelling a rename leave the open draft alone', () => {
    render(<App home="plan" clock={clock} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rotina' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rotinas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nova rotina' }));
    fireEvent.change(screen.getByLabelText('Nome da rotina'), { target: { value: 'Outro rascunho' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rotinas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Renomear Tarde' }));
    let dialog = screen.getByRole('dialog', { name: 'Renomear rotina' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Nome da rotina' }), { target: { value: 'Descartado' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('button', { name: 'Renomear Tarde' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Renomear Tarde' }));
    dialog = screen.getByRole('dialog', { name: 'Renomear rotina' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Nome da rotina' }), { target: { value: 'Trabalho' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Renomear' }));
    // An empty draft has nothing to continue: a new routine starts from scratch.
    expect(screen.queryByRole('button', { name: /^Continuar editando/ })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(KEYS.templates))[0].name).toBe('Trabalho');
  });
});

describe('finish if started now', () => {
  test('the planner shows when the routine would end and can use it as the deadline', () => {
    render(<App home="plan" clock={clock} />);
    const preview = screen.getByRole('region', { name: 'Término começando agora' });
    expect(within(preview).getByTestId('finish-time')).toHaveTextContent('14:45');
    expect(preview).toHaveTextContent('sobra 15 min antes do deadline');
    fireEvent.click(screen.getByRole('button', { name: 'Mais minutos em Almoço' }));
    expect(within(preview).getByTestId('finish-time')).toHaveTextContent('14:50');
    fireEvent.change(screen.getByLabelText('Deadline'), { target: { value: '14:00' } });
    expect(preview).toHaveTextContent('passa 50 min do deadline');
    fireEvent.click(within(preview).getByRole('button', { name: 'Usar 14:50 como deadline' }));
    expect(screen.getByLabelText('Deadline')).toHaveValue('14:50');
    expect(preview).toHaveTextContent('exatamente no deadline');
    expect(within(preview).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByTestId('ideal-start')).toHaveTextContent('12:20');
  });

  test('past midnight it shows only the time, and the deadline becomes the next day', () => {
    nowMs = local(23, 12);
    render(<App home="plan" clock={clock} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remover Orçamento' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover Preparar saída' }));
    fireEvent.change(screen.getByLabelText('Minutos de Almoço'), { target: { value: '28' } });
    const preview = screen.getByRole('region', { name: 'Término começando agora' });
    expect(within(preview).getByTestId('finish-time')).toHaveTextContent(/^00:25$/);
    fireEvent.click(within(preview).getByRole('button', { name: 'Usar 00:25 como deadline' }));
    expect(screen.getByTestId('ideal-start')).toHaveTextContent('23:12');
  });

  test('during a run it counts only what is missing and can move the deadline', () => {
    startExample();
    advance(10 * MIN);
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    const dialog = screen.getByRole('dialog', { name: 'Editar rotina' });
    const preview = within(dialog).getByRole('region', { name: 'Término começando agora' });
    expect(within(preview).getByTestId('finish-time')).toHaveTextContent('14:45');
    expect(preview).toHaveTextContent('sobra 15 min antes do deadline');
    fireEvent.click(within(preview).getByRole('button', { name: 'Usar 14:45 como deadline' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    expect(screen.getByRole('region', { name: 'Deadline da rotina' })).toHaveTextContent('Deadline 14:45');
    expect(screen.queryByRole('group', { name: 'Folga' })).not.toBeInTheDocument();
  });
});

describe('running', () => {
  test('the countdown and deadline controls follow tasks and the buffer', () => {
    startExample();
    const deadline = screen.getByRole('region', { name: 'Deadline da rotina' });
    expect(card('Folga').compareDocumentPosition(deadline)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(within(deadline).getByText('Deadline 15:00')).toBeInTheDocument();
    expect(within(deadline).getByTestId('until-deadline')).toHaveTextContent('2:40:00');
    fireEvent.click(within(deadline).getByRole('button', { name: 'Mais 5 minutos no deadline' }));
    expect(within(deadline).getByText('Deadline 15:05')).toBeInTheDocument();
    expect(within(deadline).getByTestId('until-deadline')).toHaveTextContent('2:45:00');
  });

  test('starting early creates a buffer and shows the current task', () => {
    startExample();
    expect(card('Tarefa atual: Orçamento')).toHaveTextContent('1:00:00');
    expect(card('Folga')).toHaveTextContent('+15 min');
    expect(screen.getByTestId('until-deadline')).toHaveTextContent('2:40:00');
  });

  test('swipe left completes, swipe right postpones and reactivates', () => {
    startExample();
    advance(50 * MIN);
    swipe(card('Tarefa atual: Orçamento'), -150);
    expect(card('Concluída: Orçamento')).toBeInTheDocument();
    expect(card('Tarefa atual: Guardar equipamentos')).toBeInTheDocument();
    swipe(card('Tarefa atual: Guardar equipamentos'), 150);
    expect(card('Tarefa atual: Banho e troca de roupa')).toBeInTheDocument();
    expect(taskNames().slice(0, 3)).toEqual(['Concluída: Orçamento', 'Tarefa atual: Banho e troca de roupa', 'Próxima: Guardar equipamentos']);
    swipe(card('Concluída: Orçamento'), 150);
    expect(card('Tarefa atual: Orçamento')).toHaveTextContent('10:00');
  });

  test('an upcoming task can be completed before its turn; the current stays', () => {
    startExample();
    fireEvent.pointerUp(card('Próxima: Almoço'));
    swipe(card('Próxima: Almoço'), -150);
    expect(card('Concluída: Almoço')).toBeInTheDocument();
    expect(card('Tarefa atual: Orçamento')).toBeInTheDocument();
  });

  test('tapping a card shows accessible actions', () => {
    startExample();
    const almoco = card('Próxima: Almoço');
    fireEvent.pointerDown(almoco, { clientX: 10, clientY: 10, pointerId: 1, button: 0 });
    fireEvent.pointerUp(almoco, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));
    expect(card('Concluída: Almoço')).toBeInTheDocument();
  });

  test('the last pending task does not move when postponed', () => {
    startExample();
    ['Orçamento', 'Guardar equipamentos', 'Banho e troca de roupa', 'Almoço'].forEach((name) => swipe(card(`Tarefa atual: ${name}`), -150));
    swipe(card('Tarefa atual: Preparar saída'), 150);
    expect(card('Tarefa atual: Preparar saída')).toBeInTheDocument();
  });

  test('tasks never end on their own; overrun uses the buffer, then squeezes', () => {
    startExample();
    advance(70 * MIN);
    expect(card('Tarefa atual: Orçamento')).toHaveTextContent('-10:00');
    expect(card('Folga')).toHaveTextContent('+5 min');
    advance(10 * MIN);
    expect(screen.queryByRole('group', { name: 'Folga' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Squeeze! Faltam 5 min para caber tudo.');
  });

  test('+5 min appears at 5 minutes and adds time to the current task', () => {
    startExample();
    advance(54 * MIN);
    expect(screen.queryByRole('button', { name: '+5 min' })).not.toBeInTheDocument();
    advance(2 * MIN);
    fireEvent.click(screen.getByRole('button', { name: '+5 min' }));
    expect(card('Tarefa atual: Orçamento')).toHaveTextContent('9:00');
    expect(card('Folga')).toHaveTextContent('+10 min');
  });

  test('releasing the buffer gives it to every pending task', () => {
    startExample();
    swipe(card('Folga'), -150);
    expect(screen.queryByRole('group', { name: 'Folga' })).not.toBeInTheDocument();
    expect(screen.getByTestId('until-deadline')).toHaveTextContent('2:40:00');
  });

  test('after the deadline it shows the delay in red and keeps going', () => {
    startExample();
    advance(165 * MIN);
    expect(screen.getByText('O tempo acabou')).toBeInTheDocument();
    expect(screen.getByTestId('until-deadline')).toHaveTextContent('-5:00');
    fireEvent.click(screen.getByRole('button', { name: 'Mais 5 minutos no deadline' }));
    expect(screen.getByTestId('until-deadline')).toHaveTextContent(/^0:00$/);
  });

  test('the run is restored from storage with the elapsed time counted', () => {
    const { unmount } = render(<App home="plan" clock={clock} />);
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }));
    unmount();
    nowMs += 20 * MIN;
    render(<App home="plan" clock={clock} />);
    expect(card('Tarefa atual: Orçamento')).toHaveTextContent('40:00');
  });

  test('a run is closed automatically 12 hours after the deadline', () => {
    startExample();
    document.body.innerHTML = '';
    nowMs = local(15) + 12 * 60 * MIN;
    render(<App home="plan" clock={clock} />);
    expect(screen.getByRole('button', { name: 'Começar' })).toBeInTheDocument();
    expect(screen.getByText(/encerrada automaticamente/)).toBeInTheDocument();
    expect(localStorage.getItem(KEYS.run)).toBeNull();
  });
});

describe('timeline card and actions', () => {
  test('the top card shows start, now and deadline, and the time left follows the clock', () => {
    startExample();
    const card = screen.getByRole('region', { name: 'Linha do tempo da rotina' });
    expect(within(card).getByLabelText('Início 12:20')).toBeInTheDocument();
    expect(within(card).getByLabelText('Agora 12:20')).toBeInTheDocument();
    expect(within(card).getByLabelText('Deadline 15:00')).toBeInTheDocument();
    expect(screen.getByTestId('time-left')).toHaveTextContent('2:40:00 restantes');
    expect(within(card).getByRole('progressbar')).toHaveValue(100);
    advance(80 * MIN);
    expect(within(card).getByLabelText('Agora 13:40')).toBeInTheDocument();
    expect(screen.getByTestId('time-left')).toHaveTextContent('1:20:00 restantes');
    expect(within(card).getByRole('progressbar')).toHaveValue(50);
  });

  test('after the deadline the top card shows the delay', () => {
    startExample();
    advance(170 * MIN);
    expect(screen.getByTestId('time-left')).toHaveTextContent('-10:00 atrasado');
    expect(within(screen.getByRole('region', { name: 'Linha do tempo da rotina' })).getByRole('progressbar')).toHaveValue(0);
  });

  test('edit, settings and end come after the deadline card, at the end of the routine', () => {
    startExample();
    const deadline = screen.getByRole('region', { name: 'Deadline da rotina' });
    const actions = screen.getByRole('navigation', { name: 'Ações da rotina' });
    expect(deadline.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(actions).getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(within(actions).getByRole('button', { name: 'Ajustes' })).toBeInTheDocument();
    expect(within(actions).getByRole('button', { name: 'Encerrar' })).toBeInTheDocument();
  });
});

describe('edit mode and ending', () => {
  test('editing the run name persists it and updates the template only when requested at the end', () => {
    render(<App home="plan" clock={clock} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rotina' }));
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }));
    advance(MIN);
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    const dialog = screen.getByRole('dialog', { name: 'Editar rotina' });
    expect(within(dialog).getByRole('button', { name: '+ Adicionar tarefa' }).compareDocumentPosition(within(dialog).getByLabelText('Deadline')))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    fireEvent.change(within(dialog).getByLabelText('Nome da rotina'), { target: { value: 'Tarde de trabalho' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    expect(screen.getByText('Tarde de trabalho')).toBeInTheDocument();
    expect(card('Tarefa atual: Orçamento')).toHaveTextContent('59:00');
    expect(JSON.parse(localStorage.getItem(KEYS.run)).name).toBe('Tarde de trabalho');
    expect(JSON.parse(localStorage.getItem(KEYS.templates))[0].name).toBe('Tarde');
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações na rotina' }));
    expect(JSON.parse(localStorage.getItem(KEYS.templates))[0].name).toBe('Tarde de trabalho');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Tarde de trabalho' }));
    expect(screen.getByLabelText('Nome da rotina')).toHaveValue('Tarde de trabalho');
  });

  test('editing during the run changes estimates and adds tasks', () => {
    startExample();
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    const dialog = screen.getByRole('dialog', { name: 'Editar rotina' });
    fireEvent.click(within(dialog).getByRole('button', { name: '+ Adicionar tarefa' }));
    fireEvent.change(within(dialog).getByLabelText('Nome da tarefa 6'), { target: { value: 'Café' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    expect(card('Próxima: Café')).toHaveTextContent('15 min');
    expect(screen.queryByRole('group', { name: 'Folga' })).not.toBeInTheDocument();
  });

  test('ending can update the saved routine without touching it otherwise', () => {
    render(<App home="plan" clock={clock} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rotina' }));
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover Almoço' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    let templates = JSON.parse(localStorage.getItem(KEYS.templates));
    expect(templates[0].tasks.map((t) => t.name)).toContain('Almoço');
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações na rotina' }));
    templates = JSON.parse(localStorage.getItem(KEYS.templates));
    expect(templates[0].tasks.map((t) => t.name)).not.toContain('Almoço');
    // Ending goes back to the routines.
    expect(screen.getByRole('button', { name: 'Nova rotina' })).toBeInTheDocument();
  });

  test('the end window offers saving only when a saved routine changed, in the requested order', () => {
    render(<App home="plan" clock={clock} />);
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar' }));
    let dialog = screen.getByRole('dialog', { name: 'Encerrar rotina' });
    // A routine that was never saved has nothing to update.
    expect(within(dialog).getAllByRole('button').map((b) => b.textContent))
      .toEqual(['×', 'Encerrar', 'Recomeçar com novo deadline', 'Editar rotina']);
    expect(dialog).toHaveTextContent('0 de 5 tarefas feitas');
    expect(dialog).not.toHaveTextContent('Tudo feito!');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Encerrar' }));
    // A saved routine that only ran, unchanged, has nothing to update either.
    fireEvent.click(screen.getByRole('button', { name: /^Continuar editando/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rotina' }));
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }));
    swipe(card('Tarefa atual: Orçamento'), -150);
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar' }));
    dialog = screen.getByRole('dialog', { name: 'Encerrar rotina' });
    expect(within(dialog).queryByRole('button', { name: 'Salvar alterações na rotina' })).not.toBeInTheDocument();
    // Editing a task's minutes is a change.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Editar rotina' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mais minutos em Almoço' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar' }));
    dialog = screen.getByRole('dialog', { name: 'Encerrar rotina' });
    expect(within(dialog).getAllByRole('button').map((b) => b.textContent).at(-1)).toBe('Salvar alterações na rotina');
  });

  test('restart keeps the tasks and asks only for a new deadline', () => {
    startExample();
    swipe(card('Tarefa atual: Orçamento'), -150);
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recomeçar com novo deadline' }));
    expect(screen.getByDisplayValue('Orçamento')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Começar' })).toBeInTheDocument();
  });
});

describe('links', () => {
  const link = '/?rotina=3.1800.Ler-30.Jantar-40&nome=Noite';

  test('an unnamed imported routine saves and reopens with its deadline in the name', () => {
    window.history.replaceState(null, '', '/?rotina=3.2030.Ler-30');
    const { unmount } = render(<App home="plan" clock={clock} />);
    expect(screen.getByLabelText('Nome da rotina')).toHaveValue('Rotina fim 20:30');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rotina' }));
    expect(JSON.parse(localStorage.getItem(KEYS.templates))[0].name).toBe('Rotina fim 20:30');
    unmount();
    render(<App home="plan" clock={clock} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rotinas', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Rotina fim 20:30' }));
    expect(screen.getByLabelText('Nome da rotina')).toHaveValue('Rotina fim 20:30');
  });

  test('a valid link opens in the planner and leaves the address bar', () => {
    window.history.replaceState(null, '', link);
    render(<App home="plan" clock={clock} />);
    expect(screen.getByDisplayValue('Noite')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Jantar')).toBeInTheDocument();
    expect(screen.getByTestId('ideal-start')).toHaveTextContent('16:50');
    expect(window.location.search).toBe('');
    expect(JSON.parse(localStorage.getItem(KEYS.draft)).name).toBe('Noite');
  });

  test('with a run in progress it asks before replacing', () => {
    startExample();
    document.body.innerHTML = '';
    window.history.replaceState(null, '', link);
    render(<App home="plan" clock={clock} />);
    expect(screen.getByRole('dialog', { name: 'Abrir rotina do link?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Substituir' }));
    expect(screen.getByDisplayValue('Noite')).toBeInTheDocument();
  });

  test('an invalid link changes nothing and says so', () => {
    window.history.replaceState(null, '', '/?rotina=3.9999.X-1');
    render(<App home="plan" clock={clock} />);
    expect(screen.getByText(/Não foi possível abrir a rotina do link/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Tarde')).toBeInTheDocument();
  });
});

describe('rest screen', () => {
  test('appears after 2 minutes without touches and a tap returns', () => {
    startExample();
    advance(2 * MIN);
    const rest = screen.getByRole('button', { name: /Modo descanso/ });
    expect(rest).toHaveTextContent('Orçamento');
    fireEvent.click(rest);
    expect(screen.queryByRole('button', { name: /Modo descanso/ })).not.toBeInTheDocument();
    expect(card('Tarefa atual: Orçamento')).toBeInTheDocument();
  });

  test('can be turned off in the settings', () => {
    startExample();
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    fireEvent.change(screen.getByLabelText('Modo descanso'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    advance(30 * MIN);
    expect(screen.queryByRole('button', { name: /Modo descanso/ })).not.toBeInTheDocument();
  });
});

describe('sounds before starting', () => {
  test('the planner shows whether sounds are on and switches them, in step with the settings', () => {
    render(<App home="plan" clock={clock} />);
    const toggle = screen.getByRole('switch', { name: 'Sons dos alertas' });
    expect(toggle).toBeChecked();
    expect(toggle).toHaveTextContent('Ligados');
    fireEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(toggle).toHaveTextContent('Desligados');
    expect(JSON.parse(localStorage.getItem(KEYS.settings)).sound).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    expect(screen.getByRole('switch', { name: /^Sons\s*Alertas/ })).not.toBeChecked();
    fireEvent.click(screen.getByRole('switch', { name: /^Sons\s*Alertas/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.getByRole('switch', { name: 'Sons dos alertas' })).toBeChecked();
  });

  test('the choice survives a reload', () => {
    const { unmount } = render(<App home="plan" clock={clock} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Sons dos alertas' }));
    unmount();
    render(<App home="plan" clock={clock} />);
    expect(screen.getByRole('switch', { name: 'Sons dos alertas' })).not.toBeChecked();
  });
});

describe('card sizes', () => {
  // The swipeable body fills a wrapper that carries the height.
  const heightOf = (name) => parseFloat(card(name).parentElement.style.height);

  test('longer tasks get taller cards, far less than proportionally, with a minimum', () => {
    localStorage.setItem(KEYS.draft, JSON.stringify({ name: 'Tamanhos', deadline: '14:00', tasks: [
      { id: 'a', name: 'Atual', minutes: 10 }, { id: 'c', name: 'Curta', minutes: 5 },
      { id: 'l', name: 'Longa', minutes: 50 }, { id: 'm', name: 'Mínima', minutes: 1 },
    ] }));
    nowMs = local(12, 54);
    startExample();
    expect(heightOf('Próxima: Longa')).toBeGreaterThan(heightOf('Próxima: Curta') * 3);
    expect(heightOf('Próxima: Longa')).toBeLessThan(heightOf('Próxima: Curta') * 4);
    expect(heightOf('Próxima: Mínima')).toBe(60);
    expect(heightOf('Próxima: Curta')).toBeGreaterThan(60);
  });

  test('a completed task keeps the size of the time it took', () => {
    startExample();
    advance(40 * MIN);
    swipe(card('Tarefa atual: Orçamento'), -150);
    advance(4 * MIN);
    swipe(card('Tarefa atual: Guardar equipamentos'), -150);
    expect(heightOf('Concluída: Orçamento')).toBeGreaterThan(heightOf('Concluída: Guardar equipamentos') * 2);
    expect(heightOf('Concluída: Guardar equipamentos')).toBeGreaterThanOrEqual(60);
  });
});

describe('sounds for gestures and the end of the routine', () => {
  const short = () => {
    localStorage.setItem(KEYS.draft, JSON.stringify({ name: 'Curta', deadline: '13:00', tasks: [
      { id: 'a', name: 'Um', minutes: 10 }, { id: 'b', name: 'Dois', minutes: 10 }, { id: 'c', name: 'Três', minutes: 10 },
    ] }));
  };

  test('completing plays a small win, postponing a swap, the last one celebrates and opens the end', () => {
    short();
    const feedback = vi.fn();
    render(<App home="plan" clock={clock} feedback={feedback} />);
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }));
    swipe(card('Tarefa atual: Um'), -150);
    expect(feedback).toHaveBeenLastCalledWith('done');
    swipe(card('Tarefa atual: Dois'), 150);
    expect(feedback).toHaveBeenLastCalledWith('postpone');
    swipe(card('Tarefa atual: Três'), -150);
    expect(feedback).toHaveBeenLastCalledWith('done');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    swipe(card('Tarefa atual: Dois'), -150);
    expect(feedback).toHaveBeenLastCalledWith('finish');
    const dialog = screen.getByRole('dialog', { name: 'Encerrar rotina' });
    expect(dialog).toHaveTextContent('Tudo feito!');
    expect(dialog).toHaveTextContent('3 tarefas');
    expect(dialog).toHaveTextContent('antes do deadline');
    // A gesture that changes nothing makes no sound.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    feedback.mockClear();
    swipe(card('Concluída: Um'), -150);
    expect(feedback).not.toHaveBeenCalled();
  });

  test('with sounds off the gestures are silent', () => {
    short();
    localStorage.setItem(KEYS.settings, JSON.stringify({ sound: false, restAfterMin: 2, reminderMin: 2 }));
    const feedback = vi.fn();
    render(<App home="plan" clock={clock} feedback={feedback} />);
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }));
    swipe(card('Tarefa atual: Um'), -150);
    swipe(card('Tarefa atual: Dois'), 150);
    expect(feedback).not.toHaveBeenCalled();
  });

  test('the end window after the last task restarts, edits or just ends', () => {
    short();
    const finish = () => ['Um', 'Dois', 'Três'].forEach((name) => swipe(card(`Tarefa atual: ${name}`), -150));
    const { unmount } = render(<App home="plan" clock={clock} feedback={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }));
    finish();
    // Closing keeps the finished timeline; its button brings the window back.
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Fechar' }));
    expect(screen.getByText('Tudo feito!')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar rotina' }));
    // Editing continues the run with new tasks.
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Encerrar rotina' })).getByRole('button', { name: 'Editar rotina' }));
    expect(screen.getByRole('dialog', { name: 'Editar rotina' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar rotina' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Encerrar rotina' })).getByRole('button', { name: 'Encerrar' }));
    expect(localStorage.getItem(KEYS.templates)).toBeNull();
    expect(screen.getByRole('button', { name: 'Nova rotina' })).toBeInTheDocument();
    unmount();

    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    render(<App home="plan" clock={clock} feedback={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }));
    finish();
    fireEvent.click(screen.getByRole('button', { name: 'Recomeçar com novo deadline' }));
    expect(screen.getByRole('textbox', { name: 'Nome da tarefa 1' })).toHaveValue('Um');
    expect(localStorage.getItem(KEYS.run)).toBeNull();
    // The planner opens at the deadline and its suggestion.
    expect(scrollIntoView.mock.contexts.at(-1).contains(screen.getByLabelText('Deadline'))).toBe(true);
    delete Element.prototype.scrollIntoView;
  });
});

describe('sharing during the routine', () => {
  afterEach(() => { delete navigator.share; });
  // Lets the share promise chain settle.
  const flush = async () => { for (let i = 0; i < 5; i += 1) await Promise.resolve(); };
  const shareRun = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar rotina' }));
    await act(flush);
  };

  test('opens the system share sheet with the routine as it stands', async () => {
    navigator.share = vi.fn(() => Promise.resolve());
    startExample();
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome da tarefa 5' }), { target: { value: 'Sair de casa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await shareRun();
    const { title, url } = navigator.share.mock.calls[0][0];
    expect(title).toBe('Tarde — Squeeze');
    expect(url).toMatch(/^http:\/\/localhost:3000\/\?rotina=3\.1500\.Or%C3%A7amento-60\./);
    expect(decodeURIComponent(url)).toContain('Sair_de_casa-20');
  });

  test('without a share sheet the link is copied; a cancelled share does nothing', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    startExample();
    await shareRun();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('rotina=3.1500.'));
    expect(screen.getByRole('status')).toHaveTextContent('Link copiado.');
    navigator.share = vi.fn(() => Promise.reject(Object.assign(new Error('cancel'), { name: 'AbortError' })));
    writeText.mockClear();
    await shareRun();
    expect(writeText).not.toHaveBeenCalled();
  });
});

describe('reordering during the routine', () => {
  // jsdom has no layout: each list item is 100 px tall, in order.
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rect() {
      const id = this.dataset?.motionId;
      if (!id) return { top: 0, left: 0, width: 300, height: 0, bottom: 0, right: 300 };
      // eslint-disable-next-line testing-library/no-node-access -- stands in for layout: an item's place follows its order
      const items = [...this.parentElement.children];
      const top = items.indexOf(this) * 108;
      return { top, left: 0, width: 300, height: 100, bottom: top + 100, right: 300 };
    });
  });
  afterEach(() => { vi.restoreAllMocks(); });

  const handle = (name) => screen.getByRole('button', { name: `Mover ${name}` });
  const press = (name, y = 50) => fireEvent.pointerDown(handle(name), { clientX: 280, clientY: y, pointerId: 2, button: 0 });

  test('hold the handle, then drag: the card moves and keeps its time', () => {
    const feedback = vi.fn();
    render(<App home="plan" clock={clock} feedback={feedback} />);
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }));
    const before = card('Próxima: Almoço').textContent;
    press('Almoço', 350);
    act(() => { vi.advanceTimersByTime(350); });
    fireEvent.pointerMove(handle('Almoço'), { clientX: 280, clientY: 100, pointerId: 2 });
    fireEvent.pointerUp(handle('Almoço'), { clientX: 280, clientY: 100, pointerId: 2 });
    expect(taskNames().slice(0, 3)).toEqual(['Tarefa atual: Orçamento', 'Próxima: Almoço', 'Próxima: Guardar equipamentos']);
    expect(card('Próxima: Almoço').textContent.split(' ')[0]).toBe(before.split(' ')[0]);
    expect(feedback).toHaveBeenLastCalledWith('postpone');
    // Above the current task it becomes the current one.
    press('Almoço', 150);
    act(() => { vi.advanceTimersByTime(350); });
    fireEvent.pointerMove(handle('Almoço'), { clientX: 280, clientY: 10, pointerId: 2 });
    fireEvent.pointerUp(handle('Almoço'), { clientX: 280, clientY: 10, pointerId: 2 });
    expect(card('Tarefa atual: Almoço')).toBeInTheDocument();
  });

  test('a quick drag without holding, a tap or a cancelled gesture moves nothing', () => {
    startExample();
    const order = taskNames();
    press('Almoço', 350);
    fireEvent.pointerMove(handle('Almoço'), { clientX: 280, clientY: 100, pointerId: 2 });
    act(() => { vi.advanceTimersByTime(500); });
    fireEvent.pointerUp(handle('Almoço'), { clientX: 280, clientY: 100, pointerId: 2 });
    press('Almoço', 350);
    fireEvent.pointerUp(handle('Almoço'), { clientX: 280, clientY: 350, pointerId: 2 });
    press('Almoço', 350);
    act(() => { vi.advanceTimersByTime(350); });
    fireEvent.pointerMove(handle('Almoço'), { clientX: 280, clientY: 10, pointerId: 2 });
    fireEvent.pointerCancel(handle('Almoço'), { pointerId: 2 });
    act(() => { vi.advanceTimersByTime(500); });
    expect(taskNames()).toEqual(order);
  });

  test('the arrow keys move a task one place; a single pending task has no handle', () => {
    startExample();
    fireEvent.keyDown(handle('Orçamento'), { key: 'ArrowDown' });
    expect(card('Tarefa atual: Guardar equipamentos')).toBeInTheDocument();
    const order = taskNames();
    fireEvent.keyDown(handle('Preparar saída'), { key: 'ArrowDown' });
    fireEvent.keyDown(handle('Guardar equipamentos'), { key: 'ArrowUp' });
    fireEvent.keyDown(handle('Almoço'), { key: 'Enter' });
    expect(taskNames()).toEqual(order);
    ['Guardar equipamentos', 'Orçamento', 'Banho e troca de roupa', 'Almoço'].forEach((name) => swipe(card(`Tarefa atual: ${name}`), -150));
    expect(screen.queryByRole('button', { name: /^Mover / })).not.toBeInTheDocument();
  });
});

describe('overrun reminder setting', () => {
  test('can be set to every 5 minutes or never', () => {
    render(<App home="plan" clock={clock} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    const select = screen.getByRole('combobox', { name: 'Lembrete depois do tempo' });
    expect(select).toHaveValue('2');
    fireEvent.change(select, { target: { value: '0' } });
    expect(JSON.parse(localStorage.getItem(KEYS.settings)).reminderMin).toBe(0);
  });
});

describe('home: the routines screen', () => {
  const saved = [
    { id: 'n', name: 'Noite', deadline: '21:00', templateId: null, tasks: [{ id: 'a', name: 'Ler', minutes: 120 }] },
    { id: 'm', name: 'Manhã', deadline: '07:30', templateId: null, tasks: [{ id: 'b', name: 'Banho', minutes: 50 }] },
  ];
  const listed = () => within(screen.getByRole('list', { name: 'Rotinas salvas' }))
    .getAllByRole('button', { name: /^Abrir / }).map((b) => b.getAttribute('aria-label'));

  test('the app opens on the routines; a routine opens in the planner and back', () => {
    localStorage.setItem(KEYS.templates, JSON.stringify(saved));
    render(<App clock={clock} />);
    expect(screen.getByRole('heading', { name: 'Rotinas' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Começar' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir Manhã' })).toHaveTextContent('06:40 → 07:30');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Manhã' }));
    expect(screen.getByLabelText('Nome da rotina')).toHaveValue('Manhã');
    fireEvent.click(screen.getByRole('button', { name: 'Rotinas' }));
    fireEvent.click(screen.getByRole('button', { name: /^Continuar editando/ }));
    expect(screen.getByLabelText('Nome da tarefa 1')).toHaveValue('Banho');
    fireEvent.click(screen.getByRole('button', { name: 'Rotinas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nova rotina' }));
    expect(screen.getByLabelText('Nome da rotina')).toHaveValue('');
  });

  test('routines sort by last use, end or start time, and the choice is kept', () => {
    localStorage.setItem(KEYS.templates, JSON.stringify(saved));
    const { unmount } = render(<App clock={clock} />);
    // Last used first: starting Manhã moves it to the top.
    expect(listed()).toEqual(['Abrir Noite', 'Abrir Manhã']);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Manhã' }));
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }));
    expect(JSON.parse(localStorage.getItem(KEYS.templates)).find((t) => t.id === 'm').lastUsedAt).toBe(nowMs);
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Encerrar' }));
    expect(listed()).toEqual(['Abrir Manhã', 'Abrir Noite']);
    const sort = screen.getByRole('combobox', { name: 'Ordenar rotinas' });
    fireEvent.change(sort, { target: { value: 'start' } });
    expect(listed()).toEqual(['Abrir Manhã', 'Abrir Noite']);
    fireEvent.change(sort, { target: { value: 'manual' } });
    expect(listed()).toEqual(['Abrir Noite', 'Abrir Manhã']);
    expect(screen.getByRole('button', { name: 'Subir rotina Manhã' })).toBeInTheDocument();
    fireEvent.change(sort, { target: { value: 'end' } });
    expect(listed()).toEqual(['Abrir Manhã', 'Abrir Noite']);
    expect(screen.queryByRole('button', { name: 'Subir rotina Manhã' })).not.toBeInTheDocument();
    unmount();
    render(<App clock={clock} />);
    expect(screen.getByRole('combobox', { name: 'Ordenar rotinas' })).toHaveValue('end');
  });

  test('a routine link opens straight in the planner; an empty start shows how to begin', () => {
    window.history.replaceState(null, '', '/?rotina=3.0900.Cafe-10&nome=Manha');
    const { unmount } = render(<App clock={clock} />);
    expect(screen.getByLabelText('Nome da rotina')).toHaveValue('Manha');
    unmount();
    localStorage.clear();
    render(<App clock={clock} />);
    expect(screen.getByText(/Nenhuma rotina salva ainda/)).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Ordenar rotinas' })).not.toBeInTheDocument();
  });
});

describe('alert style setting', () => {
  test('urgent by default, can be switched to soft', () => {
    render(<App home="plan" clock={clock} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    const select = screen.getByRole('combobox', { name: 'Tipo de alerta' });
    expect(select).toHaveValue('urgent');
    fireEvent.change(select, { target: { value: 'soft' } });
    expect(JSON.parse(localStorage.getItem(KEYS.settings)).alertStyle).toBe('soft');
  });
});
