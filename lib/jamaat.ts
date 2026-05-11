import type { Masjid, NextJamaat, SalahKey } from "@/types";

export const salahDisplayNames: Record<SalahKey, string> = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha"
};

export const salahOrder: SalahKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

function timeOnDate(time: string, date: Date): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function minutesBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / 60000);
}

export function getNextJamaat(masjid: Masjid, now = new Date()): NextJamaat {
  for (const salah of salahOrder) {
    const startsAt = timeOnDate(masjid.jamaat[salah], now);
    if (startsAt.getTime() >= now.getTime()) {
      return {
        salah,
        displayName: salahDisplayNames[salah],
        time: masjid.jamaat[salah],
        startsAt,
        minutesUntil: minutesBetween(now, startsAt),
        isTomorrow: false
      };
    }
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const startsAt = timeOnDate(masjid.jamaat.fajr, tomorrow);

  return {
    salah: "fajr",
    displayName: salahDisplayNames.fajr,
    time: masjid.jamaat.fajr,
    startsAt,
    minutesUntil: minutesBetween(now, startsAt),
    isTomorrow: true
  };
}

export function formatCountdown(minutes: number): string {
  if (minutes <= 0) return "Starting now";
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `in ${hours} hr` : `in ${hours} hr ${remainingMinutes} min`;
}
