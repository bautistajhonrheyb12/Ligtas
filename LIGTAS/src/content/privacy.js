// Privacy Policy, in English and Filipino. Shown by screens/LegalPage.jsx.
// Same text conventions as content/terms.js, plus these block types:
//   { collected: [[what, details, when, why]] }   { who: [[who, what]] }
//   { providers: [[name, what, privacyPolicyUrl]] } { retention: [[what, howLong]] }
// Keep this accurate to what the app actually does; when that changes, update
// the text here (and LEGAL_VERSION in lib/legal.js if the meaning changes).

const SUPABASE = 'https://supabase.com/privacy'
const VERCEL = 'https://vercel.com/legal/privacy-policy'
const GOOGLE = 'https://policies.google.com/privacy'
const OSM = 'https://osmfoundation.org/wiki/Privacy_Policy'
const FOSSGIS = 'https://www.fossgis.de/datenschutzerkl%C3%A4rung/'

export const privacy = {
  en: {
    title: 'Privacy Policy',
    intro: 'This Privacy Policy explains how the LIGTAS team collects, uses, shares, keeps and protects personal information in LIGTAS, and the rights you have under the Data Privacy Act of 2012 (Republic Act No. 10173), its Implementing Rules and Regulations, and the rules of the {npc}.',
    keyPoints: [
      ['shield', '**Only what is needed.** We collect what helps warn you and get help to you.'],
      ['users', '**Need-to-know access.** Rescuers see what they need to respond; administrators see more, to verify reports and proofs.'],
      ['accessible', '**Sensitive information stays protected.** Rescuers see priority categories only, never names or proofs.'],
      ['pin', '**Location only when it matters.** No tracking in the background; your location leaves your phone only for features that need it.'],
      ['check', '**No selling, no ads.** We never sell your information or use it for advertising.'],
      ['user', '**You are in control.** Ask to see, correct, download or delete your information at {email}.'],
    ],
    sections: [
      { id: 'who', title: 'Who we are', blocks: [
        { p: 'LIGTAS is run by the LIGTAS team in Santa Maria, Bulacan. The LIGTAS team decides how and why personal information in LIGTAS is processed, so it is the **personal information controller** under the Data Privacy Act.' },
        { p: 'For anything about your personal information, contact our Data Protection Officer at {email}.' },
      ] },
      { id: 'collect', title: 'Information we collect', blocks: [
        { collected: [
          ['Account details', 'Email address, password (stored scrambled by our sign-in provider, so no one can read it), name, mobile number and home barangay.', 'When you sign up, or edit Profile → Personal information.', 'To sign you in, let responders call you back, and show alerts for your barangay.'],
          ['Profile photo (optional)', 'A photo you choose, cut to a small square.', 'Only if you add one in Profile → Profile photo. Without one, your initials are shown.', 'To show on your profile and on the button that opens it.'],
          ['Google sign-in', 'Your name and email address from your Google account.', 'Only if you choose Continue with Google.', 'To create your account and sign you in.'],
          ['Reports and SOS', 'Type, description, location (GPS or a pinned spot, with its address, and how accurate the GPS was), photo, number of people affected, whether vulnerable people are present, and time. Your name and number are copied onto each report.', 'When you send one.', 'To verify and respond to it, and to keep a record of the incident.'],
          ['Live location after an SOS', 'Your phone\'s latest position and how accurate it is.', 'After you send an SOS, while LIGTAS stays open: when you move and about once a minute, until the SOS is resolved, 6 hours pass, or you tap Stop.', 'So rescuers find you even if you move.'],
          ['Safety check-ins', '"I\'m safe" or "Need help", with your location if available.', 'When you tap I\'m safe or send an SOS.', 'So responders know who is safe and who needs help.'],
          ['Priority rescue (sensitive)', 'Names, category (PWD, pregnant, senior citizen, child), birth year or due date, optional details, and a proof such as an ID or medical record.', 'Only if you add people, after you consent.', 'So the people who need help first are reached first.'],
          ['Your location', 'Your phone\'s position while LIGTAS is open.', 'Only if you allow location access.', 'To show you on the map, fill in report addresses, find the nearest safe evacuation center, and give directions.'],
          ['Rescuer location', 'A rescuer\'s latest position.', 'While a rescuer shares location on duty.', 'To coordinate response teams.'],
          ['Notifications', 'A notification address for your phone from your browser\'s push service (it does not identify you), the keys that encrypt messages to it, and your language.', 'Only if you turn on notifications.', 'To send alerts and updates on your reports to your phone, even when LIGTAS is closed.'],
          ['Family safety', 'The family you start or join, and when you joined.', 'Only if you start or join a family in Prepare → My family.', 'So your family can see that you are safe, or that you sent an SOS, and hear about it by notification.'],
          ['Sign-in records', 'Session records kept by our sign-in provider, such as sign-in time, device type and IP address.', 'When you sign in.', 'To keep you signed in, and to sign out lost or stolen devices.'],
          ['Security records', 'The country your network appears to be in, a scrambled (hashed) form of your IP address when a location check fails, digital signatures on reports, and a log of staff actions on reports.', 'Automatically.', 'To detect fake reports, stolen accounts and tampering, and to keep staff accountable.'],
          ['Website logs', 'Basic request logs kept by our hosting provider, such as IP address, browser type and the page requested.', 'When you open LIGTAS.', 'To deliver the site and protect it from attacks.'],
        ] },
        { p: 'We do not access your contacts, your other photos or files, your microphone, or anything in other apps. Your camera is used only when you choose to take a photo for a report or a proof.' },
      ] },
      { id: 'others', title: 'Information about other people', blocks: [
        { p: 'Reports, photos and priority entries can include information about other people, such as a neighbour who needs help or a family member listed for priority rescue. Share only what responders need. When you list someone for priority rescue, you confirm that they, or their parent or guardian, agreed.' },
      ] },
      { id: 'sensitive', title: 'Sensitive personal information', blocks: [
        { p: 'Information about disability, pregnancy, health and age is **sensitive personal information** under the Data Privacy Act. LIGTAS collects it only for priority rescue, and only after you give your consent.' },
        { list: [
          'Administrators see names, details and proofs, only to check them.',
          'Rescuers see only the categories on your household\'s SOS and reports (for example, "Senior citizen ×2"), marked as verified once an administrator has checked the proof. They never see names, details or proofs.',
          'Proofs are kept in private storage that only you and administrators can open, through links that expire after 5 minutes.',
          'You can withdraw your consent at any time in Prepare → Priority rescue. This deletes every entry and proof at once.',
        ] },
      ] },
      { id: 'use', title: 'Why we use it, and our legal basis', blocks: [
        { p: 'We process personal information only for these purposes, on these grounds under Sections 12 and 13 of the Data Privacy Act:' },
        { list: [
          ['Your consent', 'to create your account, to hold priority rescue information, to use your location while the app is open, to send you notifications, and to share your safety with the family you join. You can withdraw consent at any time; this does not affect what was done before.'],
          ['To protect life and health', 'to share reports, SOS, locations and priority categories with responders during emergencies.'],
          ['To provide the service you asked for', 'to sign you in, show alerts for your barangay, and let responders call you back.'],
          ['To keep LIGTAS reliable and safe', 'to detect fake reports, abuse and stolen accounts, which protects everyone who relies on LIGTAS in an emergency.'],
        ] },
        { p: 'We do not use your information for advertising, we do not sell it, and we do not use it for anything unrelated to disaster preparedness and response.' },
      ] },
      { id: 'automated', title: 'Automatic checks', blocks: [
        { p: 'Some decisions in LIGTAS are made automatically, to stop fake or mistaken reports quickly:' },
        { list: [
          'A report whose position is outside Santa Maria, or a GPS report impossibly far from your last one, is not accepted.',
          'Reports sent from networks outside the Philippines are marked for responders.',
          'Repeated warnings within one day pause ordinary reports until an administrator reviews them.',
        ] },
        { p: 'An SOS is never blocked. Every warning is reviewed by an administrator, who can clear it. If you think a check got it wrong, contact us and a person will look into it.' },
      ] },
      { id: 'see', title: 'Who can see your information', blocks: [
        { who: [
          ['You', 'Your profile and its photo (no one else can see your photo), your reports and their status, your check-in, and your priority entries and proofs.'],
          ['Rescuers', 'Every SOS and every verified report, with the reporter\'s name, mobile number, location, address, notes and photo; the priority categories on those calls; and safety check-ins.'],
          ['Administrators', 'Everything rescuers see, plus all reports, profiles, priority entries and proofs, security records and the activity log.'],
          ['Your family (only if you join one)', 'Your name, barangay and safety check-in, and whether you sent an SOS in the last 24 hours and how the response is going. Never your location, reports or phone number. Anyone can leave the family at any time.'],
          ['Other residents', 'None of your personal information. A verified report may become a hazard point on the map, without your name or number.'],
          ['Service providers', 'Only what they need to provide their service (see the next section).'],
          ['Authorities', 'Only when the law requires it, or when needed to protect someone\'s life or health in an emergency.'],
        ] },
        { p: 'We never sell or rent your information.' },
      ] },
      { id: 'providers', title: 'Service providers and transfers outside the Philippines', blocks: [
        { p: 'LIGTAS relies on these providers. Each handles information only to provide its service:' },
        { providers: [
          ['Supabase', 'Database, sign-in and file storage for profiles, reports, photos and proofs.', SUPABASE],
          ['Vercel', 'Hosts the LIGTAS website and app.', VERCEL],
          ['Google', 'Sign-in, only if you choose Continue with Google.', GOOGLE],
          ['OpenStreetMap', 'Map images of the area you view, and the address of a spot you pin in a report (Nominatim).', OSM],
          ['FOSSGIS (Germany)', 'Directions and travel times: your starting point and destination, and the nearest named road to a pinned spot.', FOSSGIS],
          ['Your browser\'s push service (Google, Apple, Mozilla or Microsoft)', 'Delivers notifications to your phone, if you turn them on. Messages are encrypted, so the push service cannot read them.'],
        ] },
        { p: 'Some of these providers store or process information outside the Philippines. We choose providers that protect information with industry-standard security, and we remain responsible for your information under the Data Privacy Act wherever it is processed.' },
      ] },
      { id: 'location', title: 'Your location', blocks: [
        { list: [
          'LIGTAS uses your location only while it is open, and only if you allow it. It does not track you in the background or after you close it.',
          'Showing you on the map happens on your phone. (The map images it downloads show OpenStreetMap the area you are viewing.)',
          'Your location leaves your phone only when you send a report, SOS or safety check-in; while you share your live location after an SOS; when LIGTAS looks up the address of a spot you pin; when it works out travel times to the nearest evacuation centers (which it does automatically while open); or when you ask for directions.',
          'After you send an SOS, while LIGTAS stays open, your phone keeps sending its position for that SOS, so rescuers can find you if you move. It stops when the SOS is resolved, 6 hours after you sent it, or when you tap Stop. Rescuers and administrators see it, and it is kept with the report.',
          'Routes you plan are not saved by LIGTAS.',
          'Rescuers share their location with administrators only while location sharing is turned on.',
          'Voice directions use your phone\'s own speech feature. Some phones may use an online voice service from the phone\'s maker.',
        ] },
      ] },
      { id: 'phone', title: 'Information stored on your phone', blocks: [
        { list: [
          'Recent alerts, evacuation centers, map points, your profile, your reports, your safety check-in and your family\'s latest status are saved on your phone, so they still show, and LIGTAS still opens, without a connection. This saved copy is deleted when you sign out.',
          'Rescuers\' phones also keep the latest list of calls, including each reporter\'s name and number, so they can still respond when only phone calls work. It is deleted when they sign out.',
          'Reports written without a connection wait on your phone, and are sent when you are back online.',
          'Your language, go-bag checklist and the map images you have viewed stay on your phone for offline use.',
          'Signing in keeps a session key on your phone. LIGTAS uses no advertising or tracking cookies, and no analytics.',
          'If you turn on notifications, your browser keeps a notification subscription for LIGTAS, so alerts reach you while it is closed. Turn them off in Profile → Notifications; signing out also stops them.',
          'Notifications can appear on your lock screen. They show the type and place of a report or the text of an alert, never your name or number.',
        ] },
      ] },
      { id: 'keep', title: 'How long we keep it', blocks: [
        { retention: [
          ['Account and profile', 'Until your account is deleted.'],
          ['Reports, SOS and photos', 'Until your account is deleted. They are kept as records of incidents that help later response and planning.'],
          ['Profile photo', 'Until you remove or replace it, or your account is deleted.'],
          ['Priority entries and proofs', 'Until you remove them, withdraw consent, or your account is deleted.'],
          ['Safety check-ins', 'Only your latest check-in is kept.'],
          ['Rescuer locations', 'Only the latest position, removed when the rescuer stops sharing.'],
          ['Security records', 'Until your account is deleted, so misuse can be investigated and reports can be trusted.'],
          ['Notification subscriptions', 'Until you turn notifications off. Deleted after you sign out on that phone, or when the subscription stops working.'],
          ['Family links', 'Until you leave the family, are removed from it, or your account is deleted.'],
          ['Information on your phone', 'Saved data until you sign out; settings until you clear the app\'s data.'],
        ] },
        { p: 'When your account is deleted, your profile, reports, check-ins, priority entries, security records, photos and proofs are deleted with it. Information is kept longer only where the law requires it.' },
      ] },
      { id: 'protect', title: 'How we protect it', blocks: [
        { list: [
          'Encrypted connections (HTTPS) for everything LIGTAS sends and receives.',
          'Access rules in the database for every type of account, so each person sees only what their role allows.',
          'Two-step sign-in for administrators. Sessions can be ended remotely, and stop working at once.',
          'Private storage for photos and proofs, opened only through short-lived links.',
          'Digital signatures on reports, to detect changes made outside the app.',
          'Location checks and limits against fake and automated reports.',
          'Staff are required to keep personal information confidential and to use it only for disaster response.',
        ] },
      ] },
      { id: 'breach', title: 'If there is a data breach', blocks: [
        { p: 'No system is perfectly secure. If a breach of personal information is likely to cause harm, we will notify the {npc} and the people affected within 72 hours of learning of it, as the law requires, and tell you what we are doing about it and what you can do to protect yourself.' },
      ] },
      { id: 'rights', title: 'Your rights', blocks: [
        { p: 'Under the Data Privacy Act, you have the right to:' },
        { list: [
          ['Be informed', 'of how your information is processed (this policy).'],
          ['Access', 'your information, and get a copy.'],
          ['Correct', 'information that is wrong or out of date.'],
          ['Object', 'to processing, including the automatic checks, and withdraw your consent.'],
          ['Erasure or blocking', 'of information that is no longer needed or was processed unlawfully.'],
          ['Data portability', 'to get your information in a common electronic format you can reuse.'],
          ['Damages', 'if you are harmed by inaccurate or unlawfully processed information.'],
          ['Complain', 'to the {npc} if you believe your rights were violated.'],
        ] },
        { p: '**In the app**, you can change your name, number and barangay in Profile → Personal information, withdraw a report still waiting for review, and remove priority entries or withdraw consent in Prepare → Priority rescue.' },
        { p: '**For anything else**, such as a copy of your information or deleting your account, email {email}. We may ask you to confirm your identity first. We will act without undue delay, and tell you if we need more time. These requests are free.' },
      ] },
      { id: 'children', title: 'Children', blocks: [
        { p: 'Accounts are for people 18 and older, or younger people with a parent\'s or guardian\'s permission. Information about children also reaches LIGTAS when a parent or guardian lists them for priority rescue; it is used only for that.' },
      ] },
      { id: 'changes', title: 'Changes to this policy', blocks: [
        { p: 'We update the date at the top whenever this policy changes. If a change matters, we will ask you to accept the new version in the app before you continue.' },
      ] },
      { id: 'contact', title: 'Contact us', blocks: [
        { p: 'Privacy questions and requests: {email} (Data Protection Officer, LIGTAS team, Santa Maria, Bulacan).' },
        { p: 'You may also contact the {npc}.' },
        { note: 'This email is not monitored for emergencies. In an emergency, call {rescue}.' },
      ] },
    ],
  },

  tl: {
    title: 'Patakaran sa Privacy',
    intro: 'Ipinapaliwanag ng Patakaran sa Privacy na ito kung paano kinokolekta, ginagamit, ibinabahagi, iniingatan at pinoprotektahan ng LIGTAS team ang personal na impormasyon sa LIGTAS, at ang mga karapatan mo sa ilalim ng Data Privacy Act of 2012 (Republic Act No. 10173), ng Implementing Rules and Regulations nito, at ng mga patakaran ng {npc}.',
    keyPoints: [
      ['shield', '**Ang kailangan lang.** Kinokolekta namin ang nakakatulong para mabalaan at matulungan ka.'],
      ['users', '**Ayon lang sa pangangailangan.** Nakikita ng mga rescuer ang kailangan nila para tumugon; mas marami ang nakikita ng mga administrator para masuri ang mga ulat at patunay.'],
      ['accessible', '**Protektado ang sensitibong impormasyon.** Kategorya lang ng priority ang nakikita ng mga rescuer, hindi ang pangalan o patunay.'],
      ['pin', '**Lokasyon kapag kailangan lang.** Hindi ka sinusubaybayan sa background; lumalabas lang sa telepono mo ang lokasyon para sa mga feature na nangangailangan nito.'],
      ['check', '**Walang pagbebenta, walang ads.** Hindi namin kailanman ibinebenta ang impormasyon mo o ginagamit ito sa advertising.'],
      ['user', '**Ikaw ang may kontrol.** Hilinging makita, itama, i-download o burahin ang impormasyon mo sa {email}.'],
    ],
    sections: [
      { id: 'who', title: 'Sino kami', blocks: [
        { p: 'Ang LIGTAS ay pinapatakbo ng LIGTAS team sa Santa Maria, Bulacan. Ang LIGTAS team ang nagpapasya kung paano at bakit pinoproseso ang personal na impormasyon sa LIGTAS, kaya ito ang **personal information controller** sa ilalim ng Data Privacy Act.' },
        { p: 'Para sa anumang tungkol sa personal mong impormasyon, makipag-ugnayan sa aming Data Protection Officer sa {email}.' },
      ] },
      { id: 'collect', title: 'Impormasyong kinokolekta namin', blocks: [
        { collected: [
          ['Detalye ng account', 'Email address, password (naka-scramble sa sign-in provider namin, kaya walang makakabasa nito), pangalan, numero ng mobile at barangay.', 'Kapag nag-sign up ka, o binago mo ang Profile → Personal na impormasyon.', 'Para ma-sign in ka, matawagan ka ng mga tagatugon, at maipakita ang mga babala para sa barangay mo.'],
          ['Larawan sa profile (hindi kailangan)', 'Larawang pinili mo, ginawang maliit na parisukat.', 'Kung maglalagay ka lang sa Profile → Larawan sa profile. Kung wala, initials mo ang makikita.', 'Para makita sa profile mo at sa button na nagbubukas nito.'],
          ['Google sign-in', 'Ang pangalan at email address mo mula sa Google account mo.', 'Kung pipiliin mo lang ang Continue with Google.', 'Para magawa ang account mo at ma-sign in ka.'],
          ['Mga ulat at SOS', 'Uri, paglalarawan, lokasyon (GPS o naka-pin na lugar, kasama ang address nito, at kung gaano katumpak ang GPS), litrato, bilang ng apektado, kung may bulnerableng tao, at oras. Kinokopya sa bawat ulat ang pangalan at numero mo.', 'Kapag nagpadala ka.', 'Para masuri at matugunan ito, at maitala ang insidente.'],
          ['Live na lokasyon pagkatapos ng SOS', 'Ang pinakahuling posisyon ng telepono mo at kung gaano ito katumpak.', 'Pagkatapos mong magpadala ng SOS, habang bukas ang LIGTAS: kapag lumipat ka at mga isang beses kada minuto, hanggang malutas ang SOS, lumipas ang 6 na oras, o pindutin mo ang Itigil.', 'Para mahanap ka ng mga rescuer kahit lumipat ka.'],
          ['Safety check-in', '"Ligtas ako" o "Kailangan ng tulong", kasama ang lokasyon mo kung mayroon.', 'Kapag pinindot mo ang Ligtas ako o nagpadala ng SOS.', 'Para malaman ng mga tagatugon kung sino ang ligtas at sino ang nangangailangan ng tulong.'],
          ['Priority rescue (sensitibo)', 'Mga pangalan, kategorya (PWD, buntis, senior citizen, bata), taon ng kapanganakan o due date, opsyonal na detalye, at patunay gaya ng ID o medical record.', 'Kung magdadagdag ka lang ng tao, matapos kang pumayag.', 'Para unang marating ang mga dapat unahing tulungan.'],
          ['Ang lokasyon mo', 'Ang posisyon ng telepono mo habang bukas ang LIGTAS.', 'Kung papayagan mo lang ang access sa lokasyon.', 'Para maipakita ka sa mapa, mapunan ang address ng ulat, mahanap ang pinakamalapit na ligtas na evacuation center, at makapagbigay ng direksyon.'],
          ['Lokasyon ng rescuer', 'Ang pinakahuling posisyon ng rescuer.', 'Habang nagbabahagi ng lokasyon ang rescuer habang naka-duty.', 'Para maayos ang koordinasyon ng mga team.'],
          ['Mga notification', 'Isang notification address ng telepono mo mula sa push service ng browser mo (hindi ka nito nakikilala), ang mga key na nag-e-encrypt ng mga mensahe rito, at ang wika mo.', 'Kung bubuksan mo lang ang notifications.', 'Para maipadala sa telepono mo ang mga alerto at update sa mga ulat mo, kahit nakasara ang LIGTAS.'],
          ['Kaligtasan ng pamilya', 'Ang pamilyang sinimulan o sinalihan mo, at kailan ka sumali.', 'Kung magsisimula o sasali ka lang sa pamilya sa Maghanda → Aking pamilya.', 'Para makita ng pamilya mo na ligtas ka, o na nagpadala ka ng SOS, at maabisuhan sila.'],
          ['Rekord ng sign-in', 'Rekord ng session na hawak ng sign-in provider namin, gaya ng oras ng sign-in, uri ng device at IP address.', 'Kapag nag-sign in ka.', 'Para manatili kang naka-sign in, at ma-sign out ang nawala o nanakaw na device.'],
          ['Rekord pangseguridad', 'Ang bansang mukhang pinanggagalingan ng network mo, naka-scramble (hashed) na anyo ng IP address mo kapag pumalya ang location check, digital signature sa mga ulat, at talaan ng mga ginawa ng staff sa mga ulat.', 'Awtomatiko.', 'Para matukoy ang pekeng ulat, nanakaw na account at pakikialam, at mapanagot ang staff.'],
          ['Log ng website', 'Simpleng log ng request na hawak ng hosting provider namin, gaya ng IP address, uri ng browser at pahinang hiniling.', 'Kapag binuksan mo ang LIGTAS.', 'Para maihatid ang site at maprotektahan ito sa mga atake.'],
        ] },
        { p: 'Hindi namin ina-access ang mga contact mo, ang iba mong litrato o file, ang mikropono mo, o anumang nasa ibang app. Ginagamit lang ang camera kapag pinili mong kumuha ng litrato para sa ulat o patunay.' },
      ] },
      { id: 'others', title: 'Impormasyon tungkol sa ibang tao', blocks: [
        { p: 'Puwedeng may impormasyon tungkol sa ibang tao ang mga ulat, litrato at priority entry, gaya ng kapitbahay na nangangailangan ng tulong o kapamilyang nakalista para sa priority rescue. Ibahagi lang ang kailangan ng mga tagatugon. Kapag naglista ka ng tao para sa priority rescue, kinukumpirma mong pumayag siya, o ang magulang o tagapag-alaga niya.' },
      ] },
      { id: 'sensitive', title: 'Sensitibong personal na impormasyon', blocks: [
        { p: 'Ang impormasyon tungkol sa kapansanan, pagbubuntis, kalusugan at edad ay **sensitibong personal na impormasyon** sa ilalim ng Data Privacy Act. Kinokolekta lang ito ng LIGTAS para sa priority rescue, at matapos mo lang ibigay ang pahintulot mo.' },
        { list: [
          'Nakikita ng mga administrator ang mga pangalan, detalye at patunay, para lang suriin ang mga ito.',
          'Kategorya lang ang nakikita ng mga rescuer sa SOS at mga ulat ng bahay mo (halimbawa, "Senior citizen ×2"), na may markang beripikado kapag nasuri na ng administrator ang patunay. Hindi nila kailanman nakikita ang pangalan, detalye o patunay.',
          'Nakatago ang mga patunay sa pribadong storage na ikaw at ang mga administrator lang ang makakabukas, gamit ang link na nag-e-expire pagkalipas ng 5 minuto.',
          'Puwede mong bawiin ang pahintulot mo anumang oras sa Maghanda → Priority rescue. Mabubura nito agad ang lahat ng entry at patunay.',
        ] },
      ] },
      { id: 'use', title: 'Bakit namin ito ginagamit, at ang legal na batayan', blocks: [
        { p: 'Pinoproseso lang namin ang personal na impormasyon para sa mga layuning ito, batay sa Seksyon 12 at 13 ng Data Privacy Act:' },
        { list: [
          ['Pahintulot mo', 'para magawa ang account mo, mahawakan ang impormasyon sa priority rescue, magamit ang lokasyon mo habang bukas ang app, mapadalhan ka ng mga notification, at maibahagi ang kaligtasan mo sa pamilyang sinalihan mo. Puwede mong bawiin ang pahintulot anumang oras; hindi nito naaapektuhan ang nagawa na bago iyon.'],
          ['Para protektahan ang buhay at kalusugan', 'para maibahagi ang mga ulat, SOS, lokasyon at kategorya ng priority sa mga tagatugon sa panahon ng emergency.'],
          ['Para maibigay ang serbisyong hiniling mo', 'para ma-sign in ka, maipakita ang mga babala para sa barangay mo, at matawagan ka ng mga tagatugon.'],
          ['Para manatiling maaasahan at ligtas ang LIGTAS', 'para matukoy ang pekeng ulat, pang-aabuso at nanakaw na account, na nagpoprotekta sa lahat ng umaasa sa LIGTAS sa emergency.'],
        ] },
        { p: 'Hindi namin ginagamit ang impormasyon mo sa advertising, hindi namin ito ibinebenta, at hindi namin ito ginagamit sa anumang walang kinalaman sa paghahanda at pagtugon sa sakuna.' },
      ] },
      { id: 'automated', title: 'Mga awtomatikong pagsusuri', blocks: [
        { p: 'May ilang desisyon sa LIGTAS na awtomatikong ginagawa, para mapahinto agad ang peke o maling ulat:' },
        { list: [
          'Hindi tinatanggap ang ulat na ang posisyon ay nasa labas ng Santa Maria, o ang GPS na ulat na imposibleng kalayo mula sa huli mong ulat.',
          'May marka para sa mga tagatugon ang mga ulat mula sa network sa labas ng Pilipinas.',
          'Ang paulit-ulit na babala sa loob ng isang araw ay nagpapahinto sa mga karaniwang ulat hanggang suriin ng administrator.',
        ] },
        { p: 'Hindi kailanman hinaharang ang SOS. Sinusuri ng administrator ang bawat babala at puwede niya itong i-clear. Kung sa tingin mo ay nagkamali ang isang pagsusuri, makipag-ugnayan sa amin at titingnan ito ng isang tao.' },
      ] },
      { id: 'see', title: 'Sino ang nakakakita ng impormasyon mo', blocks: [
        { who: [
          ['Ikaw', 'Ang profile mo at ang larawan nito (walang ibang nakakakita ng larawan mo), ang mga ulat mo at ang status ng mga ito, ang check-in mo, at ang mga priority entry at patunay mo.'],
          ['Mga rescuer', 'Bawat SOS at bawat beripikadong ulat, kasama ang pangalan, numero, lokasyon, address, tala at litrato ng nag-ulat; ang mga kategorya ng priority sa mga tawag na iyon; at mga safety check-in.'],
          ['Mga administrator', 'Lahat ng nakikita ng mga rescuer, pati ang lahat ng ulat, profile, priority entry at patunay, rekord pangseguridad, at talaan ng aktibidad.'],
          ['Ang pamilya mo (kung sumali ka lang)', 'Ang pangalan, barangay at safety check-in mo, at kung nagpadala ka ng SOS sa nakaraang 24 na oras at kumusta ang pagtugon. Hindi kailanman ang lokasyon, mga ulat o numero ng telepono mo. Puwedeng umalis sa pamilya ang sinuman anumang oras.'],
          ['Ibang residente', 'Wala sa personal mong impormasyon. Puwedeng maging hazard point sa mapa ang beripikadong ulat, nang wala ang pangalan o numero mo.'],
          ['Mga service provider', 'Ang kailangan lang nila para maibigay ang serbisyo nila (tingnan ang susunod na bahagi).'],
          ['Mga awtoridad', 'Kapag hinihingi lang ng batas, o kapag kailangan para protektahan ang buhay o kalusugan ng isang tao sa emergency.'],
        ] },
        { p: 'Hindi namin kailanman ibinebenta o pinapaupahan ang impormasyon mo.' },
      ] },
      { id: 'providers', title: 'Mga service provider at paglilipat sa labas ng Pilipinas', blocks: [
        { p: 'Umaasa ang LIGTAS sa mga provider na ito. Hinahawakan lang ng bawat isa ang impormasyon para maibigay ang serbisyo nito:' },
        { providers: [
          ['Supabase', 'Database, sign-in at storage ng file para sa mga profile, ulat, litrato at patunay.', SUPABASE],
          ['Vercel', 'Nagho-host ng website at app ng LIGTAS.', VERCEL],
          ['Google', 'Sign-in, kung pipiliin mo lang ang Continue with Google.', GOOGLE],
          ['OpenStreetMap', 'Mga larawan ng mapa ng lugar na tinitingnan mo, at ang address ng lugar na pinin mo sa ulat (Nominatim).', OSM],
          ['FOSSGIS (Germany)', 'Direksyon at tagal ng biyahe: ang simula at destinasyon mo, at ang pinakamalapit na kalyeng may pangalan sa naka-pin na lugar.', FOSSGIS],
          ['Push service ng browser mo (Google, Apple, Mozilla o Microsoft)', 'Naghahatid ng mga notification sa telepono mo, kung bubuksan mo ang mga ito. Naka-encrypt ang mga mensahe, kaya hindi ito mababasa ng push service.'],
        ] },
        { p: 'Ang ilan sa mga provider na ito ay nag-iimbak o nagpoproseso ng impormasyon sa labas ng Pilipinas. Pumipili kami ng mga provider na nagpoprotekta ng impormasyon ayon sa karaniwang pamantayan sa seguridad ng industriya, at kami pa rin ang mananagot sa impormasyon mo sa ilalim ng Data Privacy Act saanman ito iproseso.' },
      ] },
      { id: 'location', title: 'Ang lokasyon mo', blocks: [
        { list: [
          'Ginagamit lang ng LIGTAS ang lokasyon mo habang bukas ito, at kung papayagan mo lang. Hindi ka nito sinusubaybayan sa background o kapag nakasara na ito.',
          'Sa telepono mo mismo nangyayari ang pagpapakita sa iyo sa mapa. (Ang mga larawan ng mapa na dina-download nito ay nagpapakita sa OpenStreetMap ng lugar na tinitingnan mo.)',
          'Lumalabas lang sa telepono mo ang lokasyon mo kapag nagpadala ka ng ulat, SOS o safety check-in; habang ibinabahagi mo ang live na lokasyon mo pagkatapos ng SOS; kapag hinahanap ng LIGTAS ang address ng lugar na pinin mo; kapag kinukuwenta nito ang tagal ng biyahe papunta sa pinakamalapit na evacuation center (awtomatiko habang bukas ito); o kapag humingi ka ng direksyon.',
          'Pagkatapos mong magpadala ng SOS, habang bukas ang LIGTAS, patuloy na ipinapadala ng telepono mo ang posisyon nito para sa SOS na iyon, para mahanap ka ng mga rescuer kahit lumipat ka. Titigil ito kapag nalutas ang SOS, 6 na oras matapos mo itong ipadala, o kapag pinindot mo ang Itigil. Nakikita ito ng mga rescuer at administrator, at iniingatan kasama ng ulat.',
          'Hindi sine-save ng LIGTAS ang mga rutang pinaplano mo.',
          'Ibinabahagi lang ng mga rescuer ang lokasyon nila sa mga administrator habang naka-on ang pagbabahagi ng lokasyon.',
          'Ginagamit ng voice direction ang sariling speech feature ng telepono mo. May mga teleponong puwedeng gumamit ng online na voice service mula sa gumawa ng telepono.',
        ] },
      ] },
      { id: 'phone', title: 'Impormasyong naka-save sa telepono mo', blocks: [
        { list: [
          'Naka-save sa telepono mo ang mga bagong babala, evacuation center, map point, ang profile, mga ulat at safety check-in mo, at ang pinakahuling katayuan ng pamilya mo, para lumabas pa rin ang mga ito, at bumukas pa rin ang LIGTAS, kahit walang koneksyon. Nabubura ang naka-save na kopyang ito kapag nag-sign out ka.',
          'Nag-iingat din ang telepono ng mga rescuer ng pinakahuling listahan ng mga tawag, kasama ang pangalan at numero ng bawat nag-ulat, para makatugon pa rin sila kahit tawag lang ang gumagana. Binubura ito kapag nag-sign out sila.',
          'Ang mga ulat na isinulat nang walang koneksyon ay naghihintay sa telepono mo, at ipinapadala kapag may koneksyon na.',
          'Nananatili sa telepono mo ang wika, go-bag checklist at mga larawan ng mapang natingnan mo, para magamit offline.',
          'Nag-iiwan ng session key sa telepono mo ang pag-sign in. Walang advertising o tracking cookie at walang analytics ang LIGTAS.',
          'Kapag binuksan mo ang notifications, nag-iingat ang browser mo ng notification subscription para sa LIGTAS, para maabot ka ng mga alerto kahit nakasara ito. Maisasara ito sa Profile → Mga notification; tumitigil din ito kapag nag-sign out ka.',
          'Puwedeng lumabas ang mga notification sa lock screen mo. Ipinapakita nito ang uri at lugar ng ulat o ang teksto ng alerto, pero hindi kailanman ang pangalan o numero mo.',
        ] },
      ] },
      { id: 'keep', title: 'Gaano katagal namin ito iniingatan', blocks: [
        { retention: [
          ['Account at profile', 'Hanggang mabura ang account mo.'],
          ['Mga ulat, SOS at litrato', 'Hanggang mabura ang account mo. Iniingatan ang mga ito bilang tala ng mga insidente na nakakatulong sa mga susunod na pagtugon at pagpaplano.'],
          ['Larawan sa profile', 'Hanggang alisin o palitan mo ito, o mabura ang account mo.'],
          ['Mga priority entry at patunay', 'Hanggang tanggalin mo, bawiin mo ang pahintulot, o mabura ang account mo.'],
          ['Mga safety check-in', 'Ang pinakahuling check-in mo lang ang iniingatan.'],
          ['Lokasyon ng rescuer', 'Ang pinakahuling posisyon lang, binubura kapag tumigil sa pagbabahagi ang rescuer.'],
          ['Rekord pangseguridad', 'Hanggang mabura ang account mo, para maimbestigahan ang pang-aabuso at mapagkatiwalaan ang mga ulat.'],
          ['Mga notification subscription', 'Hanggang isara mo ang notifications. Binubura ito pagkatapos mong mag-sign out sa teleponong iyon, o kapag hindi na ito gumagana.'],
          ['Ugnayan sa pamilya', 'Hanggang umalis ka sa pamilya, alisin ka rito, o mabura ang account mo.'],
          ['Impormasyon sa telepono mo', 'Ang naka-save na data, hanggang mag-sign out ka; ang mga setting, hanggang burahin mo ang data ng app.'],
        ] },
        { p: 'Kapag nabura ang account mo, kasamang nabubura ang profile, mga ulat, check-in, priority entry, rekord pangseguridad, litrato at patunay mo. Mas matagal lang itong iingatan kung hinihingi ng batas.' },
      ] },
      { id: 'protect', title: 'Paano namin ito pinoprotektahan', blocks: [
        { list: [
          'Naka-encrypt na koneksyon (HTTPS) para sa lahat ng ipinapadala at tinatanggap ng LIGTAS.',
          'Mga patakaran sa access sa database para sa bawat uri ng account, kaya ang pinapayagan lang ng tungkulin ng bawat tao ang nakikita niya.',
          'Two-step sign-in para sa mga administrator. Puwedeng tapusin ang mga session mula sa malayo, at agad itong tumitigil gumana.',
          'Pribadong storage para sa mga litrato at patunay, binubuksan lang gamit ang panandaliang link.',
          'Digital signature sa mga ulat, para matukoy ang pagbabagong ginawa sa labas ng app.',
          'Mga location check at limitasyon laban sa peke at awtomatikong ulat.',
          'Inaatasan ang staff na ilihim ang personal na impormasyon at gamitin ito para lang sa pagtugon sa sakuna.',
        ] },
      ] },
      { id: 'breach', title: 'Kung magkaroon ng data breach', blocks: [
        { p: 'Walang sistemang lubos na ligtas. Kung may breach ng personal na impormasyon na malamang na magdulot ng pinsala, aabisuhan namin ang {npc} at ang mga apektado sa loob ng 72 oras mula nang malaman namin ito, ayon sa hinihingi ng batas, at sasabihin namin kung ano ang ginagawa namin at kung ano ang puwede mong gawin para protektahan ang sarili mo.' },
      ] },
      { id: 'rights', title: 'Ang mga karapatan mo', blocks: [
        { p: 'Sa ilalim ng Data Privacy Act, may karapatan kang:' },
        { list: [
          ['Mabigyang-alam', 'kung paano pinoproseso ang impormasyon mo (ang patakarang ito).'],
          ['Ma-access', 'ang impormasyon mo, at makakuha ng kopya.'],
          ['Ipatama', 'ang impormasyong mali o luma na.'],
          ['Tumutol', 'sa pagproseso, kasama ang mga awtomatikong pagsusuri, at bawiin ang pahintulot mo.'],
          ['Ipabura o ipa-block', 'ang impormasyong hindi na kailangan o pinroseso nang labag sa batas.'],
          ['Data portability', 'makuha ang impormasyon mo sa karaniwang electronic format na magagamit mo ulit.'],
          ['Danyos', 'kung napinsala ka ng mali o labag sa batas na pagproseso ng impormasyon.'],
          ['Magreklamo', 'sa {npc} kung naniniwala kang nalabag ang mga karapatan mo.'],
        ] },
        { p: '**Sa app**, mababago mo ang pangalan, numero at barangay mo sa Profile → Personal na impormasyon, mababawi ang ulat na hinihintay pa ang pagsusuri, at matatanggal ang mga priority entry o mababawi ang pahintulot sa Maghanda → Priority rescue.' },
        { p: '**Para sa iba pa**, gaya ng kopya ng impormasyon mo o pagbura ng account mo, mag-email sa {email}. Puwede naming hilingin na kumpirmahin mo muna ang pagkakakilanlan mo. Kikilos kami nang walang hindi makatwirang pagkaantala, at sasabihan ka namin kung kailangan namin ng mas mahabang panahon. Libre ang mga kahilingang ito.' },
      ] },
      { id: 'children', title: 'Mga bata', blocks: [
        { p: 'Para sa edad 18 pataas ang mga account, o mas bata na may pahintulot ng magulang o tagapag-alaga. Napupunta rin sa LIGTAS ang impormasyon tungkol sa mga bata kapag inilista sila ng magulang o tagapag-alaga para sa priority rescue; ginagamit lang ito para doon.' },
      ] },
      { id: 'changes', title: 'Mga pagbabago sa patakarang ito', blocks: [
        { p: 'Ina-update namin ang petsa sa itaas tuwing nagbabago ang patakarang ito. Kung mahalaga ang pagbabago, hihilingin naming tanggapin mo ang bagong bersyon sa app bago ka magpatuloy.' },
      ] },
      { id: 'contact', title: 'Makipag-ugnayan sa amin', blocks: [
        { p: 'Mga tanong at kahilingan tungkol sa privacy: {email} (Data Protection Officer, LIGTAS team, Santa Maria, Bulacan).' },
        { p: 'Puwede ka ring makipag-ugnayan sa {npc}.' },
        { note: 'Hindi binabantayan ang email na ito para sa emergency. Sa emergency, tumawag sa {rescue}.' },
      ] },
    ],
  },
}
