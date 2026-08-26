import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { CACHE_KEYS, cacheDel } from '../config/redis.js';
import { orgId } from '../lib/tenant.js';
import { getSiteSettings } from './settingsController.js';

const toLocationPayload = (settings: {
  attendanceLocationEnabled: boolean;
  campusLatitude: number | null;
  campusLongitude: number | null;
  campusRadiusMeters: number;
}) => ({
  attendanceLocationEnabled: settings.attendanceLocationEnabled,
  latitude: settings.campusLatitude,
  longitude: settings.campusLongitude,
  radiusMeters: settings.campusRadiusMeters,
  location:
    settings.campusLatitude != null && settings.campusLongitude != null
      ? {
          latitude: settings.campusLatitude,
          longitude: settings.campusLongitude,
          radiusMeters: settings.campusRadiusMeters,
        }
      : null,
});

export const getAttendanceLocation = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Organisation required.' });
    const settings = await getSiteSettings(organizationId);
    if (!settings) return res.status(404).json({ message: 'Settings not found.' });
    res.json(toLocationPayload(settings));
  } catch (err) {
    res.status(500).json({ message: 'Failed to load campus location.', error: (err as Error).message });
  }
};

export const updateAttendanceLocation = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Organisation required.' });
    const settings = await getSiteSettings(organizationId);
    if (!settings) return res.status(404).json({ message: 'Settings not found.' });

    const enabled = Boolean(req.body.attendanceLocationEnabled);
    const latitudeRaw = req.body.latitude ?? req.body.campusLatitude ?? req.body.location?.latitude;
    const longitudeRaw = req.body.longitude ?? req.body.campusLongitude ?? req.body.location?.longitude;
    const radiusRaw = req.body.radiusMeters ?? req.body.campusRadiusMeters ?? req.body.location?.radiusMeters;

    let campusLatitude: number | null = settings.campusLatitude;
    let campusLongitude: number | null = settings.campusLongitude;
    if (latitudeRaw != null && latitudeRaw !== '') {
      const latitude = Number(latitudeRaw);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        return res.status(400).json({ message: 'Latitude must be between -90 and 90.' });
      }
      campusLatitude = latitude;
    }
    if (longitudeRaw != null && longitudeRaw !== '') {
      const longitude = Number(longitudeRaw);
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        return res.status(400).json({ message: 'Longitude must be between -180 and 180.' });
      }
      campusLongitude = longitude;
    }

    const campusRadiusMeters = Math.min(
      5000,
      Math.max(25, Number(radiusRaw ?? settings.campusRadiusMeters) || 250)
    );

    if (enabled && (campusLatitude == null || campusLongitude == null)) {
      return res.status(400).json({ message: 'Pick a campus location on the map before enabling location checks.' });
    }

    const updated = await prisma.setting.update({
      where: { id: settings.id },
      data: {
        attendanceLocationEnabled: enabled,
        campusLatitude,
        campusLongitude,
        campusRadiusMeters,
      },
    });
    await cacheDel(CACHE_KEYS.publicSettings, CACHE_KEYS.publicOrg);
    res.json(toLocationPayload(updated));
  } catch (err) {
    res.status(400).json({ message: 'Could not save campus location.', error: (err as Error).message });
  }
};
