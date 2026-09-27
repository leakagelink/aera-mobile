import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import type { Coordinate } from '../../common/geo';
import { computeTripMetrics } from './trip-metrics';
import { TripsRepository, type TripSampleInput } from './trips.repository';

@Injectable()
export class TripsService {
  constructor(private readonly trips: TripsRepository) {}

  async create(userId: string, input: { startedAt: string; originName?: string; destinationName?: string; plannedGeometry?: Coordinate[] }): Promise<{ id: string }> {
    if (input.plannedGeometry && input.plannedGeometry.length === 1) {
      throw new BadRequestException('A planned route needs at least two points.');
    }
    const id = crypto.randomUUID();
    await this.trips.insertTrip({ id, userId, ...input });
    return { id };
  }

  async addSamples(userId: string, tripId: string, samples: TripSampleInput[]): Promise<{ stored: number }> {
    const trip = await this.owned(userId, tripId);
    if (trip.status !== 'active') throw new ConflictException('This trip is already complete.');
    const ordered = [...samples].sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));
    await this.trips.insertSamples(tripId, userId, ordered);
    return { stored: ordered.length };
  }

  async complete(userId: string, tripId: string): Promise<{ id: string; status: 'completed' }> {
    const trip = await this.owned(userId, tripId);
    if (trip.status !== 'active') throw new ConflictException('This trip is already complete.');
    const samples = await this.trips.listSamples(tripId);
    const endedAt = new Date().toISOString();
    const metrics = computeTripMetrics(samples, trip.startedAt, endedAt);
    const last = samples[samples.length - 1] ?? null;
    const saved = await this.trips.complete(tripId, userId, endedAt, metrics, last);
    if (!saved) throw new ConflictException('This trip is already complete.');
    return { id: tripId, status: 'completed' };
  }

  list(userId: string, limit = 20) {
    return this.trips.list(userId, limit);
  }

  async get(userId: string, tripId: string) {
    const trip = await this.trips.get(tripId, userId);
    if (!trip) throw new NotFoundException('Trip not found.');
    return trip;
  }

  async samples(userId: string, tripId: string) {
    await this.owned(userId, tripId);
    return this.trips.listSamples(tripId);
  }

  async remove(userId: string, tripId: string): Promise<{ deleted: true }> {
    const deleted = await this.trips.remove(tripId, userId);
    if (!deleted) throw new NotFoundException('Trip not found.');
    return { deleted: true };
  }

  active(userId: string) {
    return this.trips.active(userId);
  }

  private async owned(userId: string, tripId: string): Promise<{ status: 'active' | 'completed'; startedAt: string }> {
    const trip = await this.trips.findOwned(tripId, userId);
    if (!trip) throw new NotFoundException('Trip not found.');
    return trip;
  }
}
