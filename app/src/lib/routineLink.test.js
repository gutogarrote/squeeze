import { parseRoutineLink, serializeRoutineLink } from './routineLink';

const example = '?rotina=3.1500.Orçamento-60.Guardar_equipamentos-20.Banho_e_troca_de_roupa-25.Almoço-20.Preparar_saída-20&nome=Tarde';

describe('parseRoutineLink', () => {
  test('reads the spec example', () => {
    expect(parseRoutineLink(example)).toEqual({ status: 'valid', plan: {
      name: 'Tarde',
      deadline: '15:00',
      tasks: [
        { name: 'Orçamento', minutes: 60 },
        { name: 'Guardar equipamentos', minutes: 20 },
        { name: 'Banho e troca de roupa', minutes: 25 },
        { name: 'Almoço', minutes: 20 },
        { name: 'Preparar saída', minutes: 20 },
      ],
    } });
  });
  test('accepts percent-encoded accents and emoji, escapes and dashes in names', () => {
    const parsed = parseRoutineLink('?rotina=3.0130.Almo%C3%A7o-20.Caf%C3%A9_%E2%98%95-5.Treino-5-30.Ligar_p~2F_Ana~3F-10');
    expect(parsed.plan.tasks.map((t) => t.name)).toEqual(['Almoço', 'Café ☕', 'Treino-5', 'Ligar p/ Ana?']);
    expect(parsed.plan.deadline).toBe('01:30');
    expect(parsed.plan.name).toBe('Rotina fim 01:30');
  });
  test.each(['11:40', '20:30', '00:05'])('names an unnamed link after its deadline %s', (deadline) => {
    const parsed = parseRoutineLink(`?rotina=3.${deadline.replace(':', '')}.Ler-10`);
    expect(parsed.plan.name).toBe(`Rotina fim ${deadline}`);
    const url = serializeRoutineLink('https://squeeze.example/', parsed.plan);
    expect(parseRoutineLink(new URL(url).search)).toEqual(parsed);
  });
  test('absent without rotina', () => {
    expect(parseRoutineLink('?x=1')).toEqual({ status: 'absent' });
    expect(parseRoutineLink('')).toEqual({ status: 'absent' });
  });
  test.each([
    ['?rotina=2.m.~A-10', 'unsupported-version'],
    ['?rotina=3.2500.A-10', 'invalid-deadline'],
    ['?rotina=3.1500', 'missing-tasks'],
    ['?rotina=3.1500.A-0', 'invalid-minutes'],
    ['?rotina=3.1500.A-721', 'task-too-long'],
    ['?rotina=3.1500.A-720.B-720.C-1', 'routine-too-long'],
    ['?rotina=3.1500.-10', 'invalid-task'],
    ['?rotina=3.1500.A%2EB-10', 'encoded-ascii'],
    ['?rotina=3.1500.A~2Z-10', 'invalid-escape'],
    ['?rotina=3.1500.A!-10', 'invalid-name-character'],
    ['?rotina=3.1500.A-10&rotina=3.1500.B-10', 'duplicate-parameter'],
    ['?rotina=3.1500.%E0%A4-10', 'malformed-percent'],
  ])('rejects %s (%s)', (search, reason) => {
    expect(parseRoutineLink(search)).toMatchObject({ status: 'invalid', reason });
  });
  test('rejects more than 40 tasks', () => {
    const tasks = Array.from({ length: 41 }, (_, i) => `T${i}-1`).join('.');
    expect(parseRoutineLink(`?rotina=3.1500.${tasks}`)).toMatchObject({ reason: 'too-many-tasks' });
  });
});

describe('serializeRoutineLink', () => {
  test('round-trips names with spaces, punctuation and accents', () => {
    const plan = { name: 'Tarde de sexta', deadline: '15:00', tasks: [
      { name: 'Orçamento (cliente X).', minutes: 60 },
      { name: 'Almoço 🍝', minutes: 20 },
    ] };
    const url = serializeRoutineLink('https://squeeze.example/?outro=1', plan);
    expect(url.startsWith('https://squeeze.example/?outro=1&rotina=3.1500.')).toBe(true);
    expect(parseRoutineLink(new URL(url).search)).toEqual({ status: 'valid', plan });
  });
  test('refuses names with underscores', () => {
    expect(() => serializeRoutineLink('https://x.test/', { deadline: '10:00', tasks: [{ name: 'a_b', minutes: 5 }] })).toThrow();
  });
});
