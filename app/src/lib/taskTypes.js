export const taskType = (task) => ['fixed', 'buffer'].includes(task?.type) ? task.type : 'normal';
export const typeProps = (task) => taskType(task) === 'normal' ? {} : { type: task.type };

// Keep old plans compatible and enforce one buffer, including completed tasks in a run.
export function normalizeTaskTypes(tasks, hasBuffer = false) {
  return tasks.map(({ type, ...task }) => {
    if (type === 'buffer') {
      if (hasBuffer) return task;
      hasBuffer = true;
    }
    return { ...task, ...typeProps({ type }) };
  });
}
