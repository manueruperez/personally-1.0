import { cn } from '@/lib/utils';
import type { AgentState } from '@/features/agent/api';

type Color = 'green' | 'yellow' | 'red' | 'gray';

const colorFor: Record<AgentState, Color> = {
  online: 'green',
  initializing: 'yellow',
  offline: 'red',
  unknown: 'gray',
};

const classes: Record<Color, string> = {
  green: 'bg-primary shadow-[0_0_6px_hsl(var(--primary))]',
  yellow: 'bg-accent animate-pulse',
  red: 'bg-destructive animate-pulse',
  gray: 'bg-muted-foreground/40',
};

const labels: Record<AgentState, string> = {
  online: 'Bot en línea: los mensajes salen al instante',
  initializing: 'Bot arrancando',
  offline: 'Bot caído: los mensajes quedan en cola',
  unknown: 'Bot sin reportar',
};

export function AgentStatusDot({
  state,
  size = 'sm',
}: {
  state: AgentState;
  size?: 'sm' | 'md';
}) {
  const color = colorFor[state];
  return (
    <span
      className={cn(
        'inline-block rounded-full',
        size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5',
        classes[color],
      )}
      title={labels[state]}
      aria-label={labels[state]}
    />
  );
}

export function isAgentOnline(state: AgentState | undefined): boolean {
  return state === 'online';
}
