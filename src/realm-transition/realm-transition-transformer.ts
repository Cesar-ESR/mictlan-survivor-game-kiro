import type { CinematicData, CinematicStep } from '../cinematic/cinematic-types';
import type { RealmTransition } from './realm-transition-types';

export function transformTransitionToCinematicData(transition: RealmTransition): CinematicData {
  const steps: CinematicStep[] = [
    { type: 'background', image: transition.realm.background },
    ...transition.dialog.map(d => ({
      type: 'dialog' as const,
      speaker: d.speaker,
      name: transition.guide.name,
      portrait: transition.guide.portrait,
      text: d.text,
    })),
  ];

  return {
    id: `realm-transition-${transition.id}`,
    title: transition.realm.name,
    steps,
  };
}
