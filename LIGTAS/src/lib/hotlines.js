// Emergency numbers shown to citizens. Only nationwide numbers are listed by
// default; add your verified local MDRRMO, BFP station and barangay numbers here
// (number is what gets dialled, display is what people read).
export const hotlines = [
  {
    name: 'National Emergency Hotline',
    description: 'Police, fire and medical emergencies',
    number: '911',
    display: '911',
    tone: 'red',
    icon: 'sos',
  },
  {
    name: 'Philippine Red Cross',
    description: 'Rescue, ambulance and blood services',
    number: '143',
    display: '143',
    tone: 'red',
    icon: 'medical',
  },
]
