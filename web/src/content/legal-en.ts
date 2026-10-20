import type { LegalDocs } from "./legal";

// Draft legal texts. Not final: a Jordanian lawyer must review them before
// launch. [Square brackets] mark details to complete once the company exists
// and the lawyer has decided. {email}, {site} and {retention} are filled in
// when the page is shown. The Arabic version prevails if the two differ.

export const legalEn: LegalDocs = {
  terms: {
    title: "Terms and Conditions",
    intro:
      "These terms govern your use of {site} (the platform). By using the site, creating an account or posting an ad you accept these terms, the Privacy Policy, the Posting Policy and the Reporting Policy. If you don't accept them, don't use the site. The Arabic version prevails.",
    sections: [
      {
        h: "1. Who we are",
        p: ["The platform is operated by [company name], a [legal form] registered in the Hashemite Kingdom of Jordan under number [registration number], at [address]. Contact: {email}."],
      },
      {
        h: "2. The platform's role",
        p: [
          "The platform is a classified-ads website. Its role is technical: advertisers display their ads, and visitors browse them and contact advertisers directly.",
          "The platform does not own, sell or rent the advertised properties, does not act as an agent or real-estate broker for anyone, and is not a party to any agreement or dealing between an advertiser and anyone else.",
          "The platform does not verify ad details, the advertiser's ownership or authorisation, or the property's condition, price or legal status, unless the ad itself states that a specific check was made and what was checked.",
        ],
      },
      {
        h: "3. Your account",
        list: [
          "You must be at least 18 and legally able to enter into contracts.",
          "You must give true information and keep it up to date, keep your password secret, and you are responsible for everything done through your account.",
          "You may not create several accounts to get round limits or after a suspension, or impersonate any person or organisation.",
        ],
      },
      {
        h: "4. Ads and the advertiser's responsibility",
        p: ["Before submitting an ad you must accept the seller declaration; your acceptance is kept with the wording version and time. By accepting, you declare and undertake that:"],
        list: [
          "all information and photos in the ad are true, current and not misleading;",
          "you own the property or are properly authorised by its owner to advertise it, and can prove this on request;",
          "you have the right to publish the photos and content, and they infringe no one's rights;",
          "the ad and any resulting dealing comply with the laws and regulations in force in Jordan;",
          "you alone are fully responsible for the ad's content and for any dealing, agreement or payment that results from it.",
        ],
      },
      {
        h: "5. Review and moderation",
        list: [
          "The platform may review ads before or after publication, manually or with automated tools. The review only checks compliance with the Posting Policy; it does not mean the platform verified the details, the advertiser's ownership or capacity, or that it recommends or guarantees the ad.",
          "The platform may, without being obliged to, reject, hold, remove or ask for changes to any ad, and suspend or close accounts, for breaches of these terms or policies, suspected fraud, a report, or a request from a competent authority.",
          "Editing a published ad sends it back for review. Ads expire automatically after the period shown on the site and can be renewed.",
          "The platform keeps a record of ad creation, edits and actions taken, as described in the Privacy Policy.",
        ],
      },
      {
        h: "6. Dealings between users",
        p: [
          "All contact, negotiation, viewings, payments and contracts happen directly between you and the other party, at your own risk. View the property in person, check the other party's identity and the title deed or authorisation with the official authorities, and pay nothing, including any deposit, before that.",
          "The platform never holds money for anyone and will never ask you to transfer money to complete a deal.",
        ],
      },
      {
        h: "7. Prohibited content and reports",
        p: ["The Posting Policy sets out what may and may not be posted, and the Reporting Policy how to report and how reports are handled. Both form part of these terms."],
      },
      {
        h: "8. Intellectual property",
        p: [
          "You keep the rights in the content you post, or they stay with their owners. By posting you grant the platform a free, non-exclusive licence to display, copy, resize and format the content as needed to run the site, show the ad and promote the site, while it is published and afterwards as needed for the purposes in the Privacy Policy.",
          "The site's design, logo and own content belong to the platform. Ads may not be copied or collected automatically without written permission.",
        ],
      },
      {
        h: "9. Limitation of liability",
        list: [
          "The site is provided \"as is\" and \"as available\"; we don't guarantee it is error-free or uninterrupted.",
          "To the fullest extent permitted by Jordanian law, neither the platform nor its owners, directors or staff are liable for the content or accuracy of ads, or for any dealing, loss or damage arising from dealings between users or reliance on an ad.",
          "Nothing here excludes liability that cannot lawfully be excluded, such as liability for fraud or gross negligence.",
        ],
      },
      {
        h: "10. Indemnity",
        p: ["You will compensate the platform and its owners, directors and staff for any claim, loss or cost (including reasonable legal fees) arising from your ad, your breach of these terms or the law, or your infringement of anyone's rights."],
      },
      {
        h: "11. Suspension and closure",
        p: ["You can ask to delete your account at any time from \"My account\". The platform may suspend or close accounts that break the rules. Some data is kept for the periods in the Privacy Policy."],
      },
      {
        h: "12. Commission",
        p: ["The commission service is not active. No commission will be asked of you unless it is formally switched on and you accept a separate, explicit agreement for each ad."],
      },
      {
        h: "13. Changes to these terms",
        p: ["We may change these terms. The version and date appear at the top of the page; for material changes we will tell you and ask you to accept the new version before you continue using account features."],
      },
      {
        h: "14. Law and jurisdiction",
        p: ["These terms are governed by the laws of the Hashemite Kingdom of Jordan, and the courts of [Amman] have jurisdiction over any dispute. [To be confirmed by the lawyer.]"],
      },
      { h: "15. Contact", p: ["Questions about these terms: write to {email}."] },
    ],
  },

  privacy: {
    title: "Privacy Policy",
    intro:
      "This policy explains what data {site} collects, why, who it is shared with, how long it is kept and your rights. We aim to comply with Jordan's Personal Data Protection Law No. 24 of 2023 and its regulations [to be reviewed by the lawyer]. The Arabic version prevails.",
    sections: [
      { h: "1. Who is responsible", p: ["[Company name], [address]. Privacy questions: {email}."] },
      {
        h: "2. What we collect",
        list: [
          "Account data: display name, e-mail, phone number if you add one, preferred language. Your password is stored encrypted by our sign-in provider; we never see it.",
          "Ad data: type, price, description, photos, contact number, city and area, and a map position if you choose to set one (once maps are enabled). Location data stored inside photos is removed before upload.",
          "Declarations and consents: the wording version and time accepted, an anonymous fingerprint of your IP address (not the address itself) and your browser type.",
          "Reports and messages you send us, and any contact details you add to them.",
          "Technical and security logs: request times and errors, and anonymous counters to prevent abuse.",
        ],
      },
      {
        h: "3. Why we use it",
        list: [
          "To run the site: accounts, ads, search and contact between users.",
          "For safety and fraud prevention: reviewing ads, finding repeated photos and numbers, handling reports, protecting accounts.",
          "To meet our legal obligations and answer requests from competent authorities.",
          "To contact you about your account and ads (service messages; no marketing without your consent).",
        ],
      },
      {
        h: "4. What is public",
        p: ["Visitors see the ad's content and photos, your display name, when you joined, and an approximate position (about 1 km) if you set a pin. Your phone number is shown only when someone presses \"Show number\", with a limit per visitor. Your exact position and e-mail are never public."],
      },
      {
        h: "5. Who we share data with",
        list: [
          "Service providers that run the site for us under data-protection agreements: Supabase (database, files and sign-in; servers in Frankfurt, Germany), Vercel (hosting), and an e-mail delivery provider once enabled.",
          "Competent authorities when legally required, or to protect users' or the platform's rights.",
          "We never sell or rent your data.",
        ],
      },
      {
        h: "6. Transfers outside Jordan",
        p: ["Data is stored on servers in the European Union (Germany). We apply the safeguards Jordanian law requires for such transfers [the lawyer will specify them]."],
      },
      {
        h: "7. How long we keep data",
        list: [
          "Account data: while the account exists. When you ask for deletion your ads are withdrawn at once, then your personal data is removed or unlinked from you.",
          "Photos of ads that left the site: the files are deleted after {retention} days; a numeric fingerprint that cannot be turned back into the photo is kept to detect reposting of removed ads.",
          "Declarations, ad edit history, reports and admin actions: kept for [period set by the lawyer] for legal and security purposes.",
        ],
      },
      {
        h: "8. Your rights",
        p: ["You can access, correct and ask to delete your data, object to processing, and withdraw consent where processing relies on it. You can change most data and request account deletion in \"My account\", or write to {email} mentioning \"Privacy request\". We reply within [the legal period]."],
      },
      {
        h: "9. Cookies",
        p: ["We only use cookies the site needs to work: keeping you signed in and protecting your session. There are no advertising or third-party tracking cookies, so no separate consent is requested. If we add analytics or marketing tools, we will update this policy and ask for consent where required."],
      },
      {
        h: "10. Security",
        p: ["We use encrypted connections, strict database-level access rules, two-step login for administrators and encrypted backups. No system is perfectly secure; we will notify you and the authorities of any incident affecting your data as the law requires."],
      },
      { h: "11. Minors", p: ["The site is not intended for anyone under 18, and we don't knowingly collect their data."] },
      { h: "12. Changes", p: ["The version and date appear at the top of the page. For material changes we will tell you and ask for consent where required."] },
      { h: "13. Contact", p: ["Write to {email}."] },
    ],
  },

  "posting-policy": {
    title: "Posting Policy",
    intro: "This policy sets out what may be posted on {site}. We review ads against it and may reject, hold or remove ads that break it.",
    sections: [
      {
        h: "1. Who may post",
        list: [
          "The property's owner, or someone properly authorised by the owner (such as a licensed broker or agency), who states their capacity accurately when posting.",
          "One account per person or organisation, and one ad per property.",
        ],
      },
      {
        h: "2. Ad requirements",
        list: [
          "A real property that is actually available, at the stated location, at its real price in Jordanian dinars.",
          "A clear title and description that match the property, and the correct property type (land must not be listed as a flat, for example).",
          "Real photos of the property itself that you took or have the right to use; no photos from other ads or the internet, and no photos clearly showing people's faces, personal data or number plates.",
          "Update or withdraw the ad as soon as the property is sold or rented or any detail changes.",
        ],
      },
      {
        h: "3. Not allowed",
        list: [
          "Fake or misleading ads, or an unreal price to attract attention.",
          "Asking for a deposit, payment or money transfer before a viewing, or any payment request outside normal direct dealing.",
          "Links, phone numbers or e-mail addresses in the title or description; contact goes through the site's buttons only.",
          "Repeating the same ad, or reposting an ad removed for breaking the rules.",
          "Properties or dealings that break the law, or that you lack the legal standing to offer.",
          "Offensive, discriminatory or hateful content, or content that invades others' privacy or rights.",
          "Impersonating an owner, organisation or anyone else.",
        ],
      },
      {
        h: "4. What we do about breaches",
        list: [
          "Reject the ad with the reason, hold it while we check, or remove it.",
          "Suspend or close the account, and block phone numbers and e-mails linked to fraud.",
          "Inform the competent authorities when we suspect a crime.",
        ],
        p: ["Our review only checks compliance with this policy; it does not verify the ad's accuracy or the advertiser's ownership."],
      },
    ],
  },

  "reporting-policy": {
    title: "Reporting and Complaints Policy",
    intro: "Your reports help keep {site} safe. This policy explains how to report and what happens next.",
    sections: [
      {
        h: "1. How to report",
        list: [
          "From any ad: \"Report this ad or advertiser\", choose a reason and add details.",
          "For any other problem or a privacy request: write to {email}.",
          "You immediately get a reference number (such as L-1024). Keep it to follow up.",
        ],
      },
      {
        h: "2. What happens next",
        list: [
          "The report goes to the moderation team; we aim to review it within [48 hours] on working days, with fraud reports first.",
          "We may hold the ad while we check, then restore or remove it. Every decision is recorded with its reason, who made it and when.",
          "We tell the advertiser the decision and reason without revealing who reported.",
          "We can't always share a detailed outcome with the reporter, to protect others' privacy.",
        ],
      },
      {
        h: "3. Objections",
        p: ["If your ad was rejected or removed and you think it was a mistake, write to {email} with the ad number and your explanation, and we will review the decision."],
      },
      {
        h: "4. False reports",
        p: ["Deliberately false or repeated bad-faith reports break the rules and may lead to suspension. The number of reports per user is limited to prevent abuse."],
      },
      {
        h: "5. If you have been defrauded",
        p: ["Stop dealing immediately and transfer nothing, report the ad number to us, and contact the competent security authorities (such as the Cybercrime Unit of the Public Security Directorate). The platform is not a party to the dealing and cannot recover money, but we cooperate with the authorities as the law allows."],
      },
    ],
  },
};
