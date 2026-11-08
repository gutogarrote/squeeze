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
  render(<App clock={clock} />);
  fireEvent.click(screen.getByRole('button', { name: 'Começar' }));
}

describe('planning', () => {
  test('shows the ideal start, the total and the buffer of starting now', () => {
    render(<App clock={clock} />);
    expect(screen.getByTestId('ideal-start')).toHaveTextContent('12:35');
    expect(screen.getByText('2h 25')).toBeInTheDocument();
    expect(screen.getByText(/\+15 min de folga/)).toBeInTheDocument();
  });

  test('when the ideal start passed it shows the delay and the compression', () => {
    nowMs = local(13, 0);
    render(<App clock={clock} />);
    expect(screen.getByText('Deveria ter começado às')).toBeInTheDocument();
    expect(screen.getByText(/Atrasado 25 min/)).toHaveTextContent('as tarefas ficam com 82% da estimativa');
  });

  test('editing tasks and deadline recalculates the ideal start and persists the draft', () => {
    render(<App clock={clock} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mais 5 minutos em Orçamento' }));
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
    render(<App clock={clock} />);
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
    render(<App clock={clock} />);
    expect(screen.getByRole('button', { name: '+ Adicionar tarefa' }).compareDocumentPosition(screen.getByLabelText('Deadline')))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  test('save as asks for a name and preserves the original routine', () => {
    const { unmount } = render(<App clock={clock} />);
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
    render(<App clock={clock} />);
    expect(screen.getByLabelText('Nome da rotina')).toHaveValue('Tarde de sexta');
    fireEvent.click(screen.getByRole('button', { name: 'Rotinas' }));
    expect(screen.getByRole('button', { name: 'Abrir Tarde' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir Tarde de sexta' })).toBeInTheDocument();
  });

  test('save as rejects a blank name and cancel leaves the routines unchanged', async () => {
    render(<App clock={clock} />);
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
    const { unmount } = render(<App clock={clock} />);
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
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.getByLabelText('Nome da rotina')).toHaveValue('Trabalho');
    expect(screen.getByLabelText('Nome da tarefa 1')).toHaveValue('Rascunho pendente');
    unmount();
    render(<App clock={clock} />);
    expect(screen.getByLabelText('Nome da rotina')).toHaveValue('Trabalho');
    fireEvent.click(screen.getByRole('button', { name: 'Rotinas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Trabalho' }));
    expect(screen.getByLabelText('Nome da tarefa 1')).toHaveValue('Orçamento');
  });

  test('renaming another saved routine and cancelling a rename leave the open draft alone', () => {
    render(<App clock={clock} />);
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
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.getByLabelText('Nome da rotina')).toHaveValue('Outro rascunho');
    expect(screen.queryByLabelText('Nome da tarefa 1')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(KEYS.templates))[0].name).toBe('Trabalho');
  });
});

describe('finish if started now', () => {
  test('the planner shows when the routine would end and can use it as the deadline', () => {
    render(<App clock={clock} />);
    const preview = screen.getByRole('region', { name: 'Término começando agora' });
    expect(within(preview).getByTestId('finish-time')).toHaveTextContent('14:45');
    expect(preview).toHaveTextContent('sobra 15 min antes do deadline');
    fireEvent.click(screen.getByRole('button', { name: 'Mais 5 minutos em Almoço' }));
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
    render(<App clock={clock} />);
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
    expect(screen.getByText(/Faltam 5 min para caber tudo/)).toBeInTheDocument();
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
    const { unmount } = render(<App clock={clock} />);
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }));
    unmount();
    nowMs += 20 * MIN;
    render(<App clock={clock} />);
    expect(card('Tarefa atual: Orçamento')).toHaveTextContent('40:00');
  });

  test('a run is closed automatically 12 hours after the deadline', () => {
    startExample();
    document.body.innerHTML = '';
    nowMs = local(15) + 12 * 60 * MIN;
    render(<App clock={clock} />);
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
    render(<App clock={clock} />);
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
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar e atualizar a rotina salva' }));
    expect(JSON.parse(localStorage.getItem(KEYS.templates))[0].name).toBe('Tarde de trabalho');
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
    render(<App clock={clock} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rotina' }));
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover Almoço' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    let templates = JSON.parse(localStorage.getItem(KEYS.templates));
    expect(templates[0].tasks.map((t) => t.name)).toContain('Almoço');
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar e atualizar a rotina salva' }));
    templates = JSON.parse(localStorage.getItem(KEYS.templates));
    expect(templates[0].tasks.map((t) => t.name)).not.toContain('Almoço');
    expect(screen.getByRole('button', { name: 'Começar' })).toBeInTheDocument();
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

  test('a valid link opens in the planner and leaves the address bar', () => {
    window.history.replaceState(null, '', link);
    render(<App clock={clock} />);
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
    render(<App clock={clock} />);
    expect(screen.getByRole('dialog', { name: 'Abrir rotina do link?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Substituir' }));
    expect(screen.getByDisplayValue('Noite')).toBeInTheDocument();
  });

  test('an invalid link changes nothing and says so', () => {
    window.history.replaceState(null, '', '/?rotina=3.9999.X-1');
    render(<App clock={clock} />);
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
