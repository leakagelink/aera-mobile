import { create } from 'zustand';

import { localTripRepository, type TripRepository } from '@/data/tripRepository';
import { computeTripMetrics } from '@/features/trips/metrics';
import type { Coordinate } from '@/types/location';
import type { Trip, TripDraft, TripSample } from '@/types/trip';
import { AppError } from '@/utils/errors';
import { matchToRoute } from '@/utils/geo';
import { createId } from '@/utils/id';

type StartDraftInput = {
  originName: string;
  destinationName: string;
  routeSummary: string;
  routeProvider?: string;
  plannedGeometry?: Coordinate[];
  initialSample: TripSample;
};

type TripState = {
  trips: Trip[];
  draft: TripDraft | null;
  ready: boolean;
  hydrate: () => Promise<void>;
  startDraft: (input: StartDraftInput) => Promise<void>;
  appendSample: (sample: TripSample) => Promise<void>;
  pauseDraft: () => Promise<void>;
  resumeDraft: () => Promise<void>;
  finishDraft: () => Promise<Trip>;
  clearHistory: () => Promise<void>;
};

const repository: TripRepository = localTripRepository;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let hydration: Promise<void> | null = null;

export const useTripStore = create<TripState>((set, get) => ({
  trips: [],
  draft: null,
  ready: false,
  hydrate() {
    if (!hydration) {
      hydration = (async () => {
        const [trips, draft] = await Promise.all([repository.list(), repository.readDraft()]);
        if (draft && draft.samples.length > 0) {
          const recovered = finalize(draft, draft.samples[draft.samples.length - 1]?.timestamp ?? Date.now(), true);
          const next = await repository.save(recovered);
          await repository.clearDraft();
          set({ trips: next, draft: null, ready: true });
          return;
        }
        set({ trips, draft: null, ready: true });
      })().catch((error: unknown) => {
        hydration = null;
        throw error;
      });
    }
    return hydration;
  },
  async startDraft(input) {
    if (!get().ready) await get().hydrate();
    const draft: TripDraft = {
      id: createId('trip'),
      startedAt: input.initialSample.timestamp,
      originName: input.originName,
      destinationName: input.destinationName,
      routeSummary: input.routeSummary,
      routeProvider: input.routeProvider,
      plannedGeometry: input.plannedGeometry,
      samples: [input.initialSample],
    };
    await repository.saveDraft(draft);
    set({ draft });
  },
  async appendSample(sample) {
    const draft = get().draft;
    if (!draft) return;
    const previous = draft.samples[draft.samples.length - 1];
    if (previous && sample.timestamp <= previous.timestamp) return;
    const next: TripDraft = { ...draft, samples: [...draft.samples, sample] };
    set({ draft: next });
    if (next.samples.length % 5 === 0) {
      await repository.saveDraft(next);
      return;
    }
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const latest = get().draft;
      if (latest) void repository.saveDraft(latest);
    }, 3000);
  },
  async pauseDraft() {
    const draft = get().draft;
    if (!draft || draft.pausedAt) return;
    const next = { ...draft, pausedAt: Date.now() };
    await repository.saveDraft(next);
    set({ draft: next });
  },
  async resumeDraft() {
    const draft = get().draft;
    if (!draft?.pausedAt) return;
    const next = { ...draft, pausedAt: null, pausedMs: (draft.pausedMs ?? 0) + Math.max(0, Date.now() - draft.pausedAt) };
    await repository.saveDraft(next);
    set({ draft: next });
  },
  async finishDraft() {
    const draft = get().draft;
    if (!draft) throw new AppError('There is no active trip to save.', 'invalid');
    if (saveTimer) clearTimeout(saveTimer);
    const trip = finalize(draft, Date.now(), false);
    const trips = await repository.save(trip);
    await repository.clearDraft();
    set({ draft: null, trips });
    return trip;
  },
  async clearHistory() {
    if (saveTimer) clearTimeout(saveTimer);
    await repository.removeAll();
    set({ trips: [], draft: null });
  },
}));

function finalize(draft: TripDraft, endedAt: number, recovered: boolean): Trip {
  const metrics = computeTripMetrics(draft.samples, draft.startedAt, endedAt);
  const pausedSeconds = ((draft.pausedMs ?? 0) + (draft.pausedAt ? Math.max(0, endedAt - draft.pausedAt) : 0)) / 1000;
  const last = draft.samples[draft.samples.length - 1];
  const planned = draft.plannedGeometry ?? [];
  const routeProgress = last && planned.length >= 2 ? matchToRoute(last, planned).fraction : undefined;
  return {
    id: draft.id,
    startedAt: draft.startedAt,
    endedAt,
    durationSeconds: Math.max(0, metrics.durationSeconds - pausedSeconds),
    distanceMeters: metrics.distanceMeters,
    averageSpeedMps: metrics.averageSpeedMps,
    maxSpeedMps: metrics.maxSpeedMps,
    sampleCount: metrics.sampleCount,
    movingTimeSeconds: metrics.movingTimeSeconds,
    stoppedTimeSeconds: Math.max(0, metrics.stoppedTimeSeconds - pausedSeconds),
    samples: draft.samples,
    originName: draft.originName,
    destinationName: draft.destinationName,
    routeSummary: draft.routeSummary,
    routeProvider: draft.routeProvider,
    plannedGeometry: planned.length >= 2 ? planned : undefined,
    routeProgress,
    recovered,
  };
}
