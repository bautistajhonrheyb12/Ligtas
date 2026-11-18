// Terms of Use, in English and Filipino. Shown by screens/LegalPage.jsx.
//
// Text can use **bold** and these placeholders: {email} (privacy contact),
// {rescue} (MDRRMO Rescue hotline), {privacy} and {terms} (links to the other
// document) and {npc} (National Privacy Commission). Block types:
//   { p }  paragraph          { list: [text | [lead, text]] }
//   { callout, tone }         { note }  small print
//   { hotlines: true }        the Santa Maria hotlines
// Keep both languages saying the same thing; the English version applies if
// they differ. When the meaning changes, update LEGAL_VERSION in lib/legal.js.

export const terms = {
  en: {
    title: 'Terms of Use',
    intro: 'These Terms of Use are an agreement between you and the LIGTAS team, the people who build and run LIGTAS, the Localized Informative Geographic Tagging & Safety Mapping System for Santa Maria, Bulacan. By creating an account or using LIGTAS, you agree to these terms and to the {privacy}. If you do not agree, please do not use LIGTAS.',
    keyPoints: [
      ['sos', '**LIGTAS is not an emergency service.** If a life is in danger, call {rescue} right away, even after sending an SOS.'],
      ['alert', '**Report only what is true.** False reports and prank SOS can get your account closed and may be reported to the authorities.'],
      ['users', '**Responders see your details.** Your name, number and location go with your reports, so rescuers can reach you.'],
      ['map', '**Maps and routes are guides.** Follow the MDRRMO and barangay officials, and never take a road that looks unsafe.'],
      ['shield', '**Your information is protected.** We never sell it. The {privacy} explains your rights.'],
    ],
    sections: [
      { id: 'about', title: 'About LIGTAS and these terms', blocks: [
        { p: 'LIGTAS brings together hazard alerts, hazard maps, incident reports, SOS requests, evacuation centers with directions, and priority rescue for the people who need help first. It is free to use.' },
        { p: 'LIGTAS is built and run by the LIGTAS team. It shows the official emergency hotlines of the Municipality of Santa Maria for your convenience, but this does not make LIGTAS an official service of the Municipality.' },
        { p: 'In these terms, **you** means anyone who uses LIGTAS; **we** and **us** mean the LIGTAS team; **responders** means rescuers and administrators; and **administrators** are the operations staff who review reports and manage LIGTAS.' },
      ] },
      { id: 'emergency', title: 'LIGTAS is not an emergency service', blocks: [
        { callout: 'If a life is in danger, call {rescue} or another hotline below right away, even if you have already sent an SOS.', tone: 'danger' },
        { p: 'LIGTAS helps people share information during disasters, but we cannot promise that anyone will see your report or SOS, or that help will arrive, or arrive in time. Reports depend on your phone, your signal, our service providers and the people on duty, and any of these can fail or be delayed, especially during a disaster.' },
        { hotlines: true },
        { note: 'These are the hotlines published by the Municipality of Santa Maria. Numbers can change, so follow the Municipality\'s latest announcements.' },
      ] },
      { id: 'who', title: 'Who can use LIGTAS', blocks: [
        { list: [
          'LIGTAS is for people who live in, work in or visit Santa Maria, Bulacan, and for the responders who serve them.',
          'You must be at least 18 years old to create an account. If you are younger, a parent or guardian must create or approve your account, and is responsible for how it is used.',
          'Rescuer and administrator accounts are created only by LIGTAS administrators.',
        ] },
      ] },
      { id: 'account', title: 'Your account', blocks: [
        { list: [
          'Use your real name and a mobile number you answer, and keep them up to date in Prepare → My details. Responders call this number about your reports and SOS.',
          'Keep your password secret and do not let others use your account. You are responsible for what is done with it. If you think someone else has used it, change your password and tell us at {email}.',
          'One person, one account.',
          'If you sign in with Google, Google\'s terms also apply to that sign-in.',
          'We email you only about your account, such as confirming your email address or resetting your password.',
        ] },
      ] },
      { id: 'reports', title: 'Reports, SOS and photos', blocks: [
        { list: [
          'Report only what is really happening, as accurately as you can. When you drop a pin, LIGTAS fills in the address for you; check it, and correct it if it is wrong.',
          'Send an SOS only when you, or someone with you, needs help right away. An SOS goes straight to rescuers without waiting for review.',
          'Send only photos you took or are allowed to share. Show other people\'s faces, plate numbers or other private details only when it helps the response.',
          'Administrators review ordinary reports before rescuers act on them. They may verify, reject or close a report, and you can follow its status in My reports. You can withdraw a report while it is still waiting for review.',
          'Your reports, with your name, mobile number and location, are seen by administrators, and by rescuers once verified (an SOS at once). Verified information may be shown to other users as a hazard on the map, without your name or number.',
        ] },
      ] },
      { id: 'checks', title: 'Automatic checks and limits', blocks: [
        { p: 'To keep information reliable during emergencies, LIGTAS checks reports automatically:' },
        { list: [
          'A report whose position is outside Santa Maria is not accepted, and neither is a GPS report impossibly far from your last one. Pin the spot on the map instead.',
          'Reports sent from a network outside the Philippines are accepted, but marked for responders.',
          'To stop spam, you can have up to 3 reports waiting for review at a time, and send up to 3 reports every 10 minutes and 10 every 24 hours. SOS has its own limit of 3 every 10 minutes and is never blocked by the report limits. You can upload up to 10 report photos every 10 minutes.',
          'If an account gets three warnings in one day, its ordinary reports are paused until an administrator reviews them.',
          'Every report is digitally signed, so responders can tell if it was changed outside the app.',
        ] },
        { callout: '**These checks never block an SOS.** If something about it looks wrong, it still goes through, marked so rescuers call you first.', tone: 'info' },
      ] },
      { id: 'conduct', title: 'Things you must not do', blocks: [
        { list: [
          'Send false, prank, joke or test reports or SOS.',
          'Pretend to be someone else, a responder, or a government office.',
          'Harass, threaten or insult anyone, including in report notes.',
          'Share other people\'s personal information without a good reason or their permission.',
          'Fake your location, or try to get around the checks and limits.',
          'Try to get into accounts, information or parts of LIGTAS you are not allowed to use, or test its security without our written permission.',
          'Overload LIGTAS, copy or scrape its data, or use bots or other automated tools on it.',
          'Use LIGTAS for advertising, selling, political campaigning or anything unlawful.',
        ] },
        { p: 'Breaking these rules can lead to removed reports and a paused or closed account. False emergency reports and other unlawful acts may be referred to the proper authorities.' },
        { p: 'Found a security problem? Please tell us privately at {email} instead of testing it further. Thank you for helping keep LIGTAS safe.' },
      ] },
      { id: 'priority', title: 'Priority rescue', blocks: [
        { list: [
          'You may list the people in your household who need help first: persons with disability, pregnant women, senior citizens (60 or older) and children (under 18).',
          'List someone only with their permission or, for a child or someone who cannot decide, the permission of their parent or guardian.',
          'Proofs must be genuine, readable and unaltered.',
          'Administrators may reject or withdraw any entry. False or altered proofs may lead to your account being closed.',
          'A verified entry helps rescuers decide, but it does not guarantee that anyone will be rescued first or at a particular time. Rescuers decide based on the whole situation.',
        ] },
      ] },
      { id: 'maps', title: 'Alerts, maps and directions', blocks: [
        { list: [
          'Alerts, hazard maps, evacuation center capacity, addresses and travel times come from people and sources that can be incomplete, late or wrong. Conditions change quickly in a disaster.',
          'Always follow instructions from the MDRRMO, barangay officials and other authorities, and use your own judgment. If a road looks flooded, blocked or unsafe, do not take it, even if LIGTAS suggests it.',
          'Directions use OpenStreetMap data and a routing service run by others. Routes avoid reported hazards where possible, but cannot avoid hazards that no one has reported.',
          'If you are driving, set the route before you leave, keep your eyes on the road and obey traffic laws. Do not handle your phone while driving.',
        ] },
      ] },
      { id: 'staff', title: 'Rescuer and administrator accounts', blocks: [
        { p: 'If you have a rescuer or administrator account, you also agree to:' },
        { list: [
          'use LIGTAS and the information in it only for disaster response and preparedness in Santa Maria;',
          'keep reporters\' names, numbers, locations and priority information confidential, and not copy, screenshot or share them outside the response;',
          'open priority rescue proofs only to review them;',
          'share your location only while on duty;',
          'use two-step sign-in (administrators), and keep your devices locked; and',
          'follow the rules of your office and the Data Privacy Act of 2012.',
        ] },
        { p: 'Staff accounts may be signed out or deactivated at any time, for example when someone leaves the team.' },
      ] },
      { id: 'content', title: 'Content and ownership', blocks: [
        { list: [
          'You keep ownership of what you send. You allow the LIGTAS team, administrators and rescuers to use, copy and share it as needed to respond, to warn others and to prepare for future disasters.',
          'The LIGTAS name, logo, design and software belong to the LIGTAS team. Please do not copy them without permission.',
          'Map data is © OpenStreetMap contributors, available under the Open Database License.',
        ] },
      ] },
      { id: 'services', title: 'Services we rely on', blocks: [
        { p: 'LIGTAS uses services run by others: Supabase (database, sign-in and storage), Vercel (hosting), OpenStreetMap (maps and addresses), FOSSGIS (directions) and, if you choose, Google (sign-in). Their own terms apply to their services, and we cannot guarantee that they will always be available.' },
      ] },
      { id: 'availability', title: 'Availability and changes to LIGTAS', blocks: [
        { list: [
          'We may change, add or remove features, or end the service. We will give notice when we can.',
          'LIGTAS may be unavailable at times, including during disasters, because of network, power or service-provider problems. Some information stays on your phone for offline use, but it may be out of date.',
        ] },
      ] },
      { id: 'closing', title: 'Pausing and closing accounts', blocks: [
        { list: [
          'We may pause or close an account that breaks these terms or puts others at risk. Where it is safe to do so, we will tell you why.',
          'You may stop using LIGTAS at any time. To delete your account and its information, email {email}. The {privacy} explains what is deleted.',
        ] },
      ] },
      { id: 'liability', title: 'Disclaimers and limits of liability', blocks: [
        { p: 'LIGTAS is provided "as is" and "as available". To the extent allowed by Philippine law, the LIGTAS team does not promise that LIGTAS will always work or be free of errors, or that its information is complete, current or accurate.' },
        { p: 'To the extent allowed by law, the LIGTAS team is not liable for loss or damage caused by: delays or failures in delivering reports, SOS or alerts; relying on alerts, maps, addresses, directions or other information in LIGTAS; or the actions of other users, responders, service providers or other third parties.' },
        { p: 'Nothing in these terms limits any liability that cannot be limited under Philippine law, such as liability for fraud.' },
      ] },
      { id: 'changes', title: 'Changes to these terms', blocks: [
        { p: 'If we change these terms in a way that matters, we will update the date at the top and ask you to accept the new version the next time you open LIGTAS. SOS stays available while you decide. If you do not accept, you can stop using LIGTAS and ask us to delete your account. Small corrections, such as typos, may be made without asking again.' },
      ] },
      { id: 'law', title: 'Governing law and disputes', blocks: [
        { p: 'These terms are governed by the laws of the Republic of the Philippines. If you have a concern, please contact us first at {email} so we can try to resolve it. A dispute that cannot be resolved will be brought before the proper courts of the Province of Bulacan, without affecting any right you have under the law to go to another court or agency, such as the {npc}.' },
      ] },
      { id: 'general', title: 'Other legal terms', blocks: [
        { list: [
          'These terms and the {privacy} are the whole agreement between you and the LIGTAS team about LIGTAS.',
          'If part of these terms cannot be enforced, the rest still applies.',
          'If we do not enforce a term right away, we may still enforce it later.',
          'You may not transfer your account or these terms to anyone else.',
          'These terms are also available in Filipino. If the two versions differ, the English version applies.',
        ] },
      ] },
      { id: 'contact', title: 'Contact us', blocks: [
        { p: 'Questions about these terms: {email}. LIGTAS team, Santa Maria, Bulacan.' },
        { note: 'This email is not monitored for emergencies. In an emergency, call {rescue}.' },
      ] },
    ],
  },

  tl: {
    title: 'Mga Tuntunin ng Paggamit',
    intro: 'Ang Mga Tuntunin ng Paggamit na ito ay kasunduan sa pagitan mo at ng LIGTAS team, ang mga gumawa at nagpapatakbo ng LIGTAS, ang Localized Informative Geographic Tagging & Safety Mapping System para sa Santa Maria, Bulacan. Sa paggawa ng account o paggamit ng LIGTAS, sumasang-ayon ka sa mga tuntuning ito at sa {privacy}. Kung hindi ka sumasang-ayon, huwag gamitin ang LIGTAS.',
    keyPoints: [
      ['sos', '**Hindi emergency service ang LIGTAS.** Kapag may panganib sa buhay, tumawag agad sa {rescue}, kahit nakapagpadala ka na ng SOS.'],
      ['alert', '**Totoo lang ang iulat.** Ang pekeng ulat at pabirong SOS ay puwedeng magpasara ng account mo at maaaring iulat sa awtoridad.'],
      ['users', '**Nakikita ng mga tagatugon ang detalye mo.** Kasama sa ulat mo ang pangalan, numero at lokasyon mo, para maabot ka ng mga rescuer.'],
      ['map', '**Gabay lang ang mapa at ruta.** Sundin ang MDRRMO at mga opisyal ng barangay, at huwag dumaan sa daang mukhang delikado.'],
      ['shield', '**Protektado ang impormasyon mo.** Hindi namin ito ibinebenta. Nasa {privacy} ang mga karapatan mo.'],
    ],
    sections: [
      { id: 'about', title: 'Tungkol sa LIGTAS at sa mga tuntuning ito', blocks: [
        { p: 'Pinagsasama ng LIGTAS ang mga babala sa panganib, hazard map, ulat ng insidente, SOS, mga evacuation center na may direksyon, at priority rescue para sa mga dapat unahing tulungan. Libre itong gamitin.' },
        { p: 'Ang LIGTAS ay ginawa at pinapatakbo ng LIGTAS team. Ipinapakita nito ang mga opisyal na emergency hotline ng Bayan ng Santa Maria para sa iyong kaginhawaan, pero hindi ibig sabihin nito na opisyal na serbisyo ng Bayan ang LIGTAS.' },
        { p: 'Sa mga tuntuning ito, ang **ikaw** ay sinumang gumagamit ng LIGTAS; ang **kami** ay ang LIGTAS team; ang **mga tagatugon** ay ang mga rescuer at administrator; at ang **mga administrator** ay ang mga tauhan ng operasyon na sumusuri ng mga ulat at namamahala sa LIGTAS.' },
      ] },
      { id: 'emergency', title: 'Hindi emergency service ang LIGTAS', blocks: [
        { callout: 'Kapag may panganib sa buhay, tumawag agad sa {rescue} o sa ibang hotline sa ibaba, kahit nakapagpadala ka na ng SOS.', tone: 'danger' },
        { p: 'Tumutulong ang LIGTAS sa pagbabahagi ng impormasyon sa panahon ng sakuna, pero hindi namin maipapangako na may makakakita ng ulat o SOS mo, o na darating ang tulong, o darating ito sa tamang oras. Nakadepende ang mga ulat sa telepono mo, sa signal, sa mga service provider namin at sa mga naka-duty, at alinman dito ay puwedeng pumalya o maantala, lalo na sa panahon ng sakuna.' },
        { hotlines: true },
        { note: 'Ito ang mga hotline na inilathala ng Bayan ng Santa Maria. Puwedeng magbago ang mga numero, kaya sundin ang pinakabagong anunsyo ng Bayan.' },
      ] },
      { id: 'who', title: 'Sino ang puwedeng gumamit ng LIGTAS', blocks: [
        { list: [
          'Para sa mga nakatira, nagtatrabaho o bumibisita sa Santa Maria, Bulacan ang LIGTAS, at para sa mga tagatugong naglilingkod sa kanila.',
          'Dapat 18 taong gulang ka pataas para gumawa ng account. Kung mas bata ka, ang magulang o tagapag-alaga mo ang dapat gumawa o pumayag sa account mo, at sila ang mananagot sa paggamit nito.',
          'Ang mga account ng rescuer at administrator ay ginagawa lang ng mga administrator ng LIGTAS.',
        ] },
      ] },
      { id: 'account', title: 'Ang account mo', blocks: [
        { list: [
          'Gamitin ang totoo mong pangalan at numerong sinasagot mo, at panatilihing updated ang mga ito sa Maghanda → Aking detalye. Tinatawagan ng mga tagatugon ang numerong ito tungkol sa mga ulat at SOS mo.',
          'Ilihim ang password mo at huwag ipagamit sa iba ang account mo. Ikaw ang mananagot sa anumang ginawa gamit ito. Kung sa tingin mo ay may ibang gumamit nito, palitan ang password mo at sabihan kami sa {email}.',
          'Isang tao, isang account.',
          'Kung nag-sign in ka gamit ang Google, umiiral din ang mga tuntunin ng Google sa sign-in na iyon.',
          'Nag-e-email lang kami tungkol sa account mo, gaya ng pagkumpirma ng email address o pag-reset ng password.',
        ] },
      ] },
      { id: 'reports', title: 'Mga ulat, SOS at litrato', blocks: [
        { list: [
          'Iulat lang ang talagang nangyayari, nang tumpak hangga\'t maaari. Kapag naglagay ka ng pin, kusang pupunan ng LIGTAS ang address; suriin ito, at itama kung mali.',
          'Magpadala lang ng SOS kapag ikaw, o may kasama ka, na kailangan ng tulong agad. Diretso sa mga rescuer ang SOS nang hindi na hinihintay ang pagsusuri.',
          'Ipadala lang ang mga litratong kinuha mo o pinapayagan kang ibahagi. Ipakita lang ang mukha ng ibang tao, plaka ng sasakyan o iba pang pribadong detalye kung makakatulong ito sa pagtugon.',
          'Sinusuri muna ng mga administrator ang mga karaniwang ulat bago kumilos ang mga rescuer. Puwede nilang i-verify, tanggihan o isara ang ulat, at masusubaybayan mo ang status nito sa Aking ulat. Puwede mong bawiin ang ulat habang hinihintay pa ang pagsusuri.',
          'Nakikita ng mga administrator ang mga ulat mo kasama ang pangalan, numero at lokasyon mo, at ng mga rescuer kapag na-verify na (ang SOS, agad-agad). Puwedeng ipakita sa ibang user ang beripikadong impormasyon bilang panganib sa mapa, nang wala ang pangalan o numero mo.',
        ] },
      ] },
      { id: 'checks', title: 'Mga awtomatikong pagsusuri at limitasyon', blocks: [
        { p: 'Para manatiling maaasahan ang impormasyon sa panahon ng emergency, awtomatikong sinusuri ng LIGTAS ang mga ulat:' },
        { list: [
          'Hindi tinatanggap ang ulat na ang posisyon ay nasa labas ng Santa Maria, gayundin ang GPS na ulat na imposibleng kalayo mula sa huli mong ulat. I-pin na lang ang lugar sa mapa.',
          'Tinatanggap ang mga ulat mula sa network sa labas ng Pilipinas, pero may marka para sa mga tagatugon.',
          'Para mapigilan ang spam, hanggang 3 ulat ang puwedeng naghihintay ng pagsusuri nang sabay, at hanggang 3 ulat kada 10 minuto at 10 kada 24 na oras ang puwede mong ipadala. May sariling limitasyon ang SOS na 3 kada 10 minuto, at hindi ito kailanman hinaharangan ng mga limitasyon sa ulat. Hanggang 10 litrato ng ulat kada 10 minuto ang puwede mong i-upload.',
          'Kapag tatlong babala ang natanggap ng isang account sa loob ng isang araw, ipinapahinto muna ang mga karaniwang ulat nito hanggang suriin ng administrator.',
          'May digital signature ang bawat ulat, kaya malalaman ng mga tagatugon kung binago ito sa labas ng app.',
        ] },
        { callout: '**Hindi kailanman hinaharang ng mga pagsusuring ito ang SOS.** Kung may mukhang mali rito, dadaan pa rin ito, may marka para tawagan ka muna ng mga rescuer.', tone: 'info' },
      ] },
      { id: 'conduct', title: 'Mga bawal gawin', blocks: [
        { list: [
          'Magpadala ng peke, pabiro o pang-test na ulat o SOS.',
          'Magpanggap bilang ibang tao, tagatugon, o tanggapan ng gobyerno.',
          'Manligalig, manakot o mang-insulto ng sinuman, kasama sa mga tala ng ulat.',
          'Ibahagi ang personal na impormasyon ng ibang tao nang walang mabuting dahilan o pahintulot nila.',
          'Pekein ang lokasyon mo, o subukang lusutan ang mga pagsusuri at limitasyon.',
          'Subukang pasukin ang mga account, impormasyon o bahagi ng LIGTAS na hindi ka pinapayagang gamitin, o subukin ang seguridad nito nang walang nakasulat naming pahintulot.',
          'Pabigatin ang LIGTAS, kopyahin o i-scrape ang data nito, o gumamit ng bot o iba pang awtomatikong tool dito.',
          'Gamitin ang LIGTAS sa pag-aanunsyo, pagbebenta, pangangampanya sa pulitika o anumang labag sa batas.',
        ] },
        { p: 'Ang paglabag sa mga patakarang ito ay puwedeng humantong sa pagtanggal ng mga ulat at pagpapahinto o pagsasara ng account. Ang pekeng ulat ng emergency at iba pang labag sa batas ay maaaring iulat sa kinauukulang awtoridad.' },
        { p: 'May nakitang problema sa seguridad? Pakisabi sa amin nang pribado sa {email} sa halip na subukan pa ito. Salamat sa pagtulong na panatilihing ligtas ang LIGTAS.' },
      ] },
      { id: 'priority', title: 'Priority rescue', blocks: [
        { list: [
          'Puwede mong ilista ang mga kasama sa bahay na dapat unahing tulungan: mga may kapansanan, buntis, senior citizen (60 pataas) at bata (wala pang 18).',
          'Ilista lang ang isang tao kung pumayag siya o, para sa bata o taong hindi makapagpasya, kung pumayag ang magulang o tagapag-alaga niya.',
          'Dapat totoo, nababasa at hindi binago ang mga patunay.',
          'Puwedeng tanggihan o bawiin ng administrator ang anumang entry. Ang peke o binagong patunay ay puwedeng magpasara ng account mo.',
          'Nakakatulong sa desisyon ng mga rescuer ang beripikadong entry, pero hindi nito ginagarantiya na uunahing iligtas ang sinuman o sa partikular na oras. Ang mga rescuer ang magpapasya batay sa buong sitwasyon.',
        ] },
      ] },
      { id: 'maps', title: 'Mga babala, mapa at direksyon', blocks: [
        { list: [
          'Ang mga babala, hazard map, kapasidad ng evacuation center, address at tagal ng biyahe ay galing sa mga tao at source na puwedeng kulang, huli o mali. Mabilis magbago ang sitwasyon sa sakuna.',
          'Laging sundin ang utos ng MDRRMO, mga opisyal ng barangay at iba pang awtoridad, at gamitin ang sarili mong pagpapasya. Kung mukhang baha, sarado o delikado ang daan, huwag itong daanan, kahit iminumungkahi ito ng LIGTAS.',
          'Gumagamit ang mga direksyon ng data ng OpenStreetMap at routing service na pinapatakbo ng iba. Iniiwasan ng mga ruta ang mga naiulat na panganib hangga\'t maaari, pero hindi nito maiiwasan ang mga panganib na wala pang nag-uulat.',
          'Kung nagmamaneho ka, itakda ang ruta bago umalis, ituon ang mata sa daan, at sundin ang batas trapiko. Huwag hawakan ang telepono habang nagmamaneho.',
        ] },
      ] },
      { id: 'staff', title: 'Mga account ng rescuer at administrator', blocks: [
        { p: 'Kung may rescuer o administrator account ka, sumasang-ayon ka rin na:' },
        { list: [
          'gagamitin ang LIGTAS at ang impormasyon dito para lang sa pagtugon at paghahanda sa sakuna sa Santa Maria;',
          'ililihim ang pangalan, numero, lokasyon at impormasyon sa priority rescue ng mga nag-uulat, at hindi ito kokopyahin, i-screenshot o ibabahagi sa labas ng pagtugon;',
          'bubuksan lang ang mga patunay sa priority rescue para suriin ang mga ito;',
          'ibabahagi lang ang lokasyon mo habang naka-duty;',
          'gagamit ng two-step sign-in (para sa administrator), at ila-lock ang mga device mo; at',
          'susundin ang mga patakaran ng tanggapan mo at ang Data Privacy Act of 2012.',
        ] },
        { p: 'Puwedeng i-sign out o i-deactivate ang mga staff account anumang oras, halimbawa kapag umalis na sa team ang isang tao.' },
      ] },
      { id: 'content', title: 'Nilalaman at pagmamay-ari', blocks: [
        { list: [
          'Sa iyo pa rin ang anumang ipinapadala mo. Pinapayagan mo ang LIGTAS team, mga administrator at rescuer na gamitin, kopyahin at ibahagi ito kung kailangan para tumugon, magbabala sa iba, at maghanda sa mga susunod na sakuna.',
          'Pag-aari ng LIGTAS team ang pangalan, logo, disenyo at software ng LIGTAS. Huwag kopyahin ang mga ito nang walang pahintulot.',
          'Ang data ng mapa ay © mga contributor ng OpenStreetMap, makukuha sa ilalim ng Open Database License.',
        ] },
      ] },
      { id: 'services', title: 'Mga serbisyong ginagamit namin', blocks: [
        { p: 'Gumagamit ang LIGTAS ng mga serbisyong pinapatakbo ng iba: Supabase (database, sign-in at storage), Vercel (hosting), OpenStreetMap (mapa at address), FOSSGIS (direksyon) at, kung pipiliin mo, Google (sign-in). Umiiral ang sarili nilang mga tuntunin sa kanilang serbisyo, at hindi namin magagarantiya na lagi silang available.' },
      ] },
      { id: 'availability', title: 'Pagiging available at mga pagbabago sa LIGTAS', blocks: [
        { list: [
          'Puwede naming baguhin, dagdagan o tanggalin ang mga feature, o itigil ang serbisyo. Magbibigay kami ng abiso kung kaya.',
          'Puwedeng hindi magamit ang LIGTAS paminsan-minsan, kasama sa panahon ng sakuna, dahil sa problema sa network, kuryente o service provider. May impormasyong nananatili sa telepono mo para magamit offline, pero puwedeng luma na ito.',
        ] },
      ] },
      { id: 'closing', title: 'Pagpapahinto at pagsasara ng account', blocks: [
        { list: [
          'Puwede naming ipahinto o isara ang account na lumalabag sa mga tuntuning ito o naglalagay sa iba sa panganib. Kung ligtas gawin, sasabihin namin sa iyo ang dahilan.',
          'Puwede mong itigil ang paggamit ng LIGTAS anumang oras. Para ipabura ang account mo at ang impormasyon nito, mag-email sa {email}. Nakasaad sa {privacy} kung ano ang binubura.',
        ] },
      ] },
      { id: 'liability', title: 'Mga paalala at limitasyon ng pananagutan', blocks: [
        { p: 'Ibinibigay ang LIGTAS nang "as is" at "as available". Hangga\'t pinapayagan ng batas ng Pilipinas, hindi ipinapangako ng LIGTAS team na laging gagana ang LIGTAS o walang mali, o na kumpleto, napapanahon o tumpak ang impormasyon nito.' },
        { p: 'Hangga\'t pinapayagan ng batas, hindi mananagot ang LIGTAS team sa pagkawala o pinsalang dulot ng: pagkaantala o pagpalya sa paghahatid ng mga ulat, SOS o babala; pag-asa sa mga babala, mapa, address, direksyon o iba pang impormasyon sa LIGTAS; o mga ginawa ng ibang user, tagatugon, service provider o iba pang third party.' },
        { p: 'Walang anuman sa mga tuntuning ito ang naglilimita sa pananagutang hindi puwedeng limitahan sa ilalim ng batas ng Pilipinas, gaya ng pananagutan sa panloloko.' },
      ] },
      { id: 'changes', title: 'Mga pagbabago sa mga tuntuning ito', blocks: [
        { p: 'Kung babaguhin namin ang mga tuntuning ito sa paraang mahalaga, ia-update namin ang petsa sa itaas at hihilingin naming tanggapin mo ang bagong bersyon sa susunod mong pagbukas ng LIGTAS. Magagamit pa rin ang SOS habang nagpapasya ka. Kung hindi ka tatanggap, puwede mong itigil ang paggamit ng LIGTAS at ipabura ang account mo. Ang maliliit na pagwawasto, gaya ng typo, ay puwedeng gawin nang hindi na humihingi ulit ng pagsang-ayon.' },
      ] },
      { id: 'law', title: 'Batas na umiiral at mga hindi pagkakaunawaan', blocks: [
        { p: 'Ang mga tuntuning ito ay sakop ng mga batas ng Republika ng Pilipinas. Kung may alalahanin ka, makipag-ugnayan muna sa amin sa {email} para masubukan naming ayusin ito. Ang hindi pagkakaunawaang hindi maayos ay dadalhin sa kinauukulang hukuman sa Lalawigan ng Bulacan, nang hindi naaapektuhan ang anumang karapatan mo sa ilalim ng batas na lumapit sa ibang hukuman o ahensya, gaya ng {npc}.' },
      ] },
      { id: 'general', title: 'Iba pang tuntunin', blocks: [
        { list: [
          'Ang mga tuntuning ito at ang {privacy} ang buong kasunduan mo at ng LIGTAS team tungkol sa LIGTAS.',
          'Kung hindi maipatupad ang bahagi ng mga tuntuning ito, umiiral pa rin ang iba.',
          'Kung hindi namin agad ipinatupad ang isang tuntunin, puwede pa rin namin itong ipatupad sa ibang pagkakataon.',
          'Hindi mo puwedeng ilipat sa iba ang account mo o ang mga tuntuning ito.',
          'Ito ay salin sa Filipino ng mga tuntunin. Kung magkaiba ang dalawang bersyon, ang bersyong Ingles ang susundin.',
        ] },
      ] },
      { id: 'contact', title: 'Makipag-ugnayan sa amin', blocks: [
        { p: 'Mga tanong tungkol sa mga tuntuning ito: {email}. LIGTAS team, Santa Maria, Bulacan.' },
        { note: 'Hindi binabantayan ang email na ito para sa emergency. Sa emergency, tumawag sa {rescue}.' },
      ] },
    ],
  },
}
