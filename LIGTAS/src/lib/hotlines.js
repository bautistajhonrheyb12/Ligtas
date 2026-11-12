// Emergency numbers shown to citizens and on the About page: only the
// Municipality of Santa Maria's verified hotlines, from its official
// "Emergency Hotlines" poster. Check them against the LGU's latest list from
// time to time. (number is what gets dialled, display is what people read.)
export const hotlines = [
  {
    name: 'MDRRMO Rescue',
    description: 'Santa Maria disaster response and rescue',
    number: '+639230226973',
    display: '0923 022 6973',
    tone: 'red',
    icon: 'shield',
  },
  {
    name: 'Santa Maria Police Station',
    description: 'Police assistance',
    number: '+639985985399',
    display: '0998 598 5399',
    tone: 'blue',
    icon: 'shield',
  },
  {
    name: 'Santa Maria Fire Station',
    description: 'Fire and rescue',
    number: '+639323797359',
    display: '0932 379 7359',
    tone: 'amber',
    icon: 'fire',
  },
  {
    name: 'LGU Command Center',
    description: 'Santa Maria municipal command center',
    number: '+639232490872',
    display: '0923 249 0872',
    tone: 'violet',
    icon: 'bell',
  },
  {
    name: 'RMMMH General Hospital',
    description: 'Hospital and medical emergencies',
    number: '+639606905828',
    display: '0960 690 5828',
    tone: 'green',
    icon: 'medical',
  },
]

// The number the SOS screen and emergency messages point to.
export const rescueHotline = hotlines[0]
