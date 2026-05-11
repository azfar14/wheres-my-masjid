import type { Masjid } from "@/types";

// These are real Chennai masjid listings for MVP testing.
// IMPORTANT: Jamaat timings below are placeholders so the user flow works.
// Verify timings with the masjid notice board/admin before public launch.
export const chennaiStarterMasjids: Masjid[] = [
  {
    id: "thousand-lights-mosque",
    name: "Thousand Lights Mosque",
    locality: "Thousand Lights, Chennai",
    address: "Anna Salai, Thousand Lights, Chennai, Tamil Nadu",
    coordinates: { lat: 13.055, lng: 80.255 },
    facilities: ["Wudu", "Large prayer hall", "Landmark masjid"],
    khutbahLanguages: ["Tamil", "Urdu", "Arabic"],
    verificationStatus: "demo_unverified",
    lastVerifiedAt: "2026-05-04",
    jamaat: {
      fajr: "05:10",
      dhuhr: "13:30",
      asr: "17:15",
      maghrib: "18:45",
      isha: "20:15"
    },
    jumuah: ["13:15"],
    notes: "Real Chennai masjid listing. Jamaat timings are placeholders for MVP flow testing; verify before public launch."
  },
  {
    id: "triplicane-big-mosque-wallajah",
    name: "Triplicane Big Mosque / Wallajah Mosque",
    locality: "Triplicane, Chennai",
    address: "Triplicane High Road, Triplicane, Chennai, Tamil Nadu",
    coordinates: { lat: 13.06, lng: 80.27 },
    facilities: ["Wudu", "Courtyard", "Large prayer hall"],
    khutbahLanguages: ["Tamil", "Urdu", "Arabic"],
    verificationStatus: "demo_unverified",
    lastVerifiedAt: "2026-05-04",
    jamaat: {
      fajr: "05:10",
      dhuhr: "13:30",
      asr: "17:15",
      maghrib: "18:45",
      isha: "20:15"
    },
    jumuah: ["13:15", "14:00"],
    notes: "Real Chennai masjid listing. Jamaat timings are placeholders for MVP flow testing; verify before public launch."
  },
  {
    id: "mamoor-mosque-george-town",
    name: "Mamoor Mosque / Masjid-e-Mamoor",
    locality: "George Town, Chennai",
    address: "Angappan Street, George Town, Chennai, Tamil Nadu",
    coordinates: { lat: 13.0945, lng: 80.2901 },
    facilities: ["Wudu", "Historic masjid"],
    khutbahLanguages: ["Tamil", "Urdu", "Arabic"],
    verificationStatus: "demo_unverified",
    lastVerifiedAt: "2026-05-04",
    jamaat: {
      fajr: "05:10",
      dhuhr: "13:30",
      asr: "17:15",
      maghrib: "18:45",
      isha: "20:15"
    },
    jumuah: ["13:15"],
    notes: "Real Chennai masjid listing. Jamaat timings are placeholders for MVP flow testing; verify before public launch."
  },
  {
    id: "periamet-mosque",
    name: "Periamet Mosque",
    locality: "Periamet, Chennai",
    address: "Sydnehams Road and Vepery High Road, Periamet, Chennai, Tamil Nadu",
    coordinates: { lat: 13.08468, lng: 80.27018 },
    facilities: ["Wudu", "Large prayer hall"],
    khutbahLanguages: ["Tamil", "Urdu", "Arabic"],
    verificationStatus: "demo_unverified",
    lastVerifiedAt: "2026-05-04",
    jamaat: {
      fajr: "05:10",
      dhuhr: "13:30",
      asr: "17:15",
      maghrib: "18:45",
      isha: "20:15"
    },
    jumuah: ["13:15", "14:00"],
    notes: "Real Chennai masjid listing. Jamaat timings are placeholders for MVP flow testing; verify before public launch."
  },
  {
    id: "hafiz-ahmad-khan-mosque-ice-house",
    name: "Hafiz Ahmad Khan Mosque / Ice House Mosque",
    locality: "Chepauk / Ice House, Chennai",
    address: "Quai-de-Millath Road, near Vivekanandar Illam, Chepauk, Chennai, Tamil Nadu",
    coordinates: { lat: 13.053128, lng: 80.27348 },
    facilities: ["Wudu", "Historic masjid"],
    khutbahLanguages: ["Tamil", "Urdu", "Arabic"],
    verificationStatus: "demo_unverified",
    lastVerifiedAt: "2026-05-04",
    jamaat: {
      fajr: "05:10",
      dhuhr: "13:30",
      asr: "17:15",
      maghrib: "18:45",
      isha: "20:15"
    },
    jumuah: ["13:15"],
    notes: "Real Chennai masjid listing. Jamaat timings are placeholders for MVP flow testing; verify before public launch."
  }
];

export const chennaiStarterMasjidsJson = JSON.stringify(chennaiStarterMasjids, null, 2);
