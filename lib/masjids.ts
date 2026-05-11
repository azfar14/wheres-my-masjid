import type { Masjid } from "@/types";

// Demo data only. Replace this with verified real masjid data city-by-city.
export const masjids: Masjid[] = [
  {
    id: "demo-masjid-e-noor",
    name: "Masjid-e-Noor Demo",
    locality: "Demo Market Area",
    address: "12 Demo Road, Sample City",
    coordinates: { lat: 17.385044, lng: 78.486671 },
    phone: "+91 90000 00001",
    facilities: ["Wudu", "Parking", "Jumu’ah", "Madrasa"],
    khutbahLanguages: ["Urdu", "English"],
    verificationStatus: "demo_unverified",
    lastVerifiedAt: "2026-05-04",
    jamaat: {
      fajr: "05:10",
      dhuhr: "13:30",
      asr: "17:15",
      maghrib: "18:44",
      isha: "20:15"
    },
    jumuah: ["13:15", "14:00"],
    notes: "Demo listing. Replace with verified timings before public launch."
  },
  {
    id: "demo-jamia-masjid",
    name: "Jamia Masjid Demo",
    locality: "Demo Old City",
    address: "45 Community Street, Sample City",
    coordinates: { lat: 17.3713, lng: 78.4804 },
    phone: "+91 90000 00002",
    facilities: ["Wudu", "Ladies area", "Wheelchair access", "Jumu’ah"],
    khutbahLanguages: ["Urdu"],
    verificationStatus: "demo_unverified",
    lastVerifiedAt: "2026-05-04",
    jamaat: {
      fajr: "05:05",
      dhuhr: "13:20",
      asr: "17:05",
      maghrib: "18:42",
      isha: "20:05"
    },
    jumuah: ["13:10", "13:55"],
    notes: "Demo listing. Facilities and timings are sample values."
  },
  {
    id: "demo-masjid-al-falah",
    name: "Masjid Al-Falah Demo",
    locality: "Demo IT Park",
    address: "7 Tech Park Lane, Sample City",
    coordinates: { lat: 17.4435, lng: 78.3772 },
    phone: "+91 90000 00003",
    facilities: ["Wudu", "Bike parking", "Office-area jamaat"],
    khutbahLanguages: ["English", "Urdu"],
    verificationStatus: "demo_unverified",
    lastVerifiedAt: "2026-05-04",
    jamaat: {
      fajr: "05:20",
      dhuhr: "13:40",
      asr: "17:25",
      maghrib: "18:46",
      isha: "20:20"
    },
    jumuah: ["13:30"],
    notes: "Demo listing for office/traveller use case."
  },
  {
    id: "demo-masjid-e-rahman",
    name: "Masjid-e-Rahman Demo",
    locality: "Demo Station Road",
    address: "2 Station Road, Sample City",
    coordinates: { lat: 17.422, lng: 78.4678 },
    phone: "+91 90000 00004",
    facilities: ["Wudu", "Traveller friendly", "Near station"],
    khutbahLanguages: ["Urdu", "Hindi"],
    verificationStatus: "demo_unverified",
    lastVerifiedAt: "2026-05-04",
    jamaat: {
      fajr: "05:15",
      dhuhr: "13:25",
      asr: "17:10",
      maghrib: "18:43",
      isha: "20:10"
    },
    jumuah: ["13:20", "14:10"],
    notes: "Demo listing for traveller mode near transport points."
  }
];

export function getMasjidById(id: string): Masjid | undefined {
  return masjids.find((masjid) => masjid.id === id);
}
