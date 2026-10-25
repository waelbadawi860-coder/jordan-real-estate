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
          "The platform may review ads before or after publishing, manually or with automated tools. The review only checks compliance with the Posting Policy; it does not mean the platform verified the details, the advertiser's ownership or role, nor that it recommends or guarantees the ad.",
          "The platform may, without being obliged to, refuse, pause, remove or ask to change any ad, and suspend or close accounts, for breaches of the terms or policies, suspected fraud, or following a report or a request from a competent authority.",
          "The platform may disclose data and records relating to an ad or account to the competent judicial or security authorities, upon a request issued in accordance with the law.",
          "Editing a published ad sends it back to review. Ads end automatically after the period shown on the site and can be renewed.",
          "The platform keeps a record of ad creation, edits and actions taken on them, for the periods set out in the Privacy Policy.",
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
          "Rights in the content stay with you or their owners. By publishing an ad you grant the platform a non-exclusive, free, worldwide licence to display, copy, store, resize, format and watermark the content, to run the site, show the ad and promote the platform. The licence lasts while the ad is published and then for the period needed for the retention purposes in the Privacy Policy, and does not include selling the content to others.",
          "The site's design, logo and own content belong to the platform; ads may not be copied or collected automatically without written permission.",
        ],
      },
      {
        h: "9. Limitation of liability",
        list: [
          "The site is provided \"as is\" and \"as available\"; we don't guarantee it is error-free or uninterrupted.",
          "To the fullest extent permitted by Jordanian law, neither the platform nor its owners, directors or staff are liable for the content or accuracy of ads, or for any dealing, loss or damage arising from dealings between users or reliance on an ad.",
          "If the platform is found liable, compensation is limited in all cases to what you paid the platform in the month before the claim. [The lawyer confirms this cap is legally acceptable.]",
          "The platform is not liable for delays or outages caused by force majeure or circumstances beyond its reasonable control, such as disasters, outages of hosting or telecoms providers, or cyber-attacks.",
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
        h: "12. Paid services, payment and refunds",
        p: [
          "Posting is free for individuals within the allowed number of active listings. The platform offers optional paid services: featuring a listing, moving it to the top, office packages and office verification. Featured listings are labelled as paid. The platform takes no commission on any sale or rental and never handles deal money.",
          "Prices of paid services are shown in Jordanian dinars [including/excluding] sales tax before payment. A service is activated once payment is confirmed, and an invoice is issued. You get a full refund if the service is not activated within [3] working days of confirmed payment, or if the listing is rejected before the service starts. After a service starts, only the unused part is refunded, and only if it was stopped because of the platform. Removal of a listing or badge because of your breach gives no refund.",
          "The “Verified office” badge only means the platform saw the office's documents on the review date; it is not a guarantee of the office or any listing or dealing. The badge can be removed if a violation is confirmed.",
        ],
      },
      {
        h: "13. Changes to these terms",
        p: [
          "We may change these terms. The version and date appear at the top of the page. We tell you about material changes by e-mail or a notice on the site [7] days before they take effect, and ask you to accept the new version before you continue using account features. For non-material changes, continuing to use the platform after they are published means you accept them.",
        ],
      },
      {
        h: "14. Law and jurisdiction",
        p: ["These terms are governed by the laws of the Hashemite Kingdom of Jordan, and the courts of [Amman] have jurisdiction over any dispute. [To be confirmed by the lawyer.]"],
      },
      {
        h: "15. General",
        p: [
          "The Arabic text prevails over any translation. If any clause is invalid, the rest remain in force.",
        ],
      },
      { h: "16. Contact", p: ["Questions about these terms: write to {email}."] },
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
          "Account data: display name, e-mail, phone number if you add it, and preferred language. Your password is stored encrypted by the sign-in provider; we never see it.",
          "Ad data: type, price, description, photos, contact number, city and area, and the property's map position if you choose to add one. Location data stored inside photos is removed before upload.",
          "Office verification documents: commercial registration, real-estate office licence, the owner's or manager's ID, and the registration and licence numbers.",
          "Declaration and consent records: the text version and time of acceptance, an encrypted (pseudonymous) fingerprint of your IP address instead of the address itself, and the browser type.",
          "Reports and messages you send us, and any contact details you choose to include.",
          "Payment records for paid services: amount, transfer reference and date. We do not store card or bank account details.",
          "Technical and security logs: request times and errors, and pseudonymous counters to prevent abuse.",
        ],
      },
      {
        h: "3. Why we use it, and on what basis",
        list: [
          "To provide the service you asked for: account, ads, search, contact and paid services.",
          "To meet legal obligations: answering requests from competent authorities, keeping records and invoices.",
          "Your consent: showing the property's map position, marketing messages, and transfers outside Jordan. You can withdraw consent at any time without affecting what happened before.",
          "Our legitimate interest in security and fraud prevention: reviewing ads, detecting repeated photos and numbers, handling reports and protecting accounts.",
          "We never send marketing messages without your consent.",
        ],
      },
      {
        h: "4. What is public",
        p: [
          "Visitors see the ad's content and photos, your display name or office name, when you joined, and the property's map position as you added it, if you added one. Showing the position is based on your consent and you can remove it from the ad at any time. If the property is occupied, you must get the occupant's consent before publishing interior photos or its exact position.",
          "Your phone number is shown only when someone presses \"Show number\", with a limit per visitor. Your e-mail is never public. Office documents are seen only by the review team.",
        ],
      },
      {
        h: "5. Who we share data with",
        list: [
          "Service providers that run the site for us under data processing agreements: Supabase (database, files and sign-in; servers in Frankfurt, Germany), Vercel (hosting), Resend (e-mail delivery) and Cloudflare (protection and domain names).",
          "Competent judicial or security authorities upon a request issued in accordance with the law, to prevent fraud, or to protect the rights of users or the platform.",
          "We never sell or rent your data.",
        ],
      },
      {
        h: "6. Transfers outside Jordan",
        p: [
          "Data is stored with Supabase in Germany and also processed by Vercel, Resend and Cloudflare, possibly through servers in the United States. We rely on data processing agreements and standard contractual clauses that ensure an adequate level of protection. By accepting this policy you consent to these transfers. [The lawyer confirms the requirements under Law No. 24 of 2023.]",
        ],
      },
      {
        h: "7. How long we keep data",
        list: [
          "Account data: while the account exists. When you ask for deletion your ads are withdrawn at once, then your personal data is removed or unlinked from you.",
          "Photos of ads that left the site: files are deleted after {retention} days; a fingerprint from which the photo cannot be rebuilt is kept to detect re-posting of removed ads, and is deleted with the records below.",
          "Declaration records, ad edit history, reports and admin actions, and photo fingerprints: kept for [5] years from the last related activity, then deleted or anonymised; longer if there is a dispute or a request from a competent authority.",
          "Office verification documents: for the verification period and [one year] after it ends, then deleted.",
          "Payment records and invoices: for the period required by tax law [set by the accountant].",
        ],
      },
      {
        h: "8. Your rights",
        p: [
          "You may access, correct and ask to delete your data, object to its processing, and withdraw consent where processing is based on consent. You can change most of your data in \"My account\" and request account deletion there, or write to {email} with \"Privacy request\". We answer within [30] days.",
          "You have the right to complain to the competent personal data protection authority in Jordan.",
        ],
      },
      {
        h: "9. Cookies",
        p: ["We only use cookies the site needs to work: keeping you signed in and protecting your session. There are no advertising or third-party tracking cookies, so no separate consent is requested. If we add analytics or marketing tools, we will update this policy and ask for consent where required."],
      },
      {
        h: "10. Security",
        p: [
          "We use encrypted connections, strict database access rules, two-step login for administrators and encrypted backups. No system is perfectly secure. If a breach is likely to affect your data, we notify the supervisory authority within [72] hours of learning of it, and tell you without delay.",
        ],
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
          "The property owner, or a person properly authorised by the owner (such as a licensed broker or real-estate office), who chooses their role accurately when posting.",
          "If you post as a broker or office, you must give the office name and its valid licence number issued by the Department of Lands and Survey. Unlicensed people may not offer others' properties for a fee.",
          "One account per person or organisation, and one ad per property. If several brokers post the same property, the platform may keep the ad of the one holding the owner's written authorisation (or the oldest, if this cannot be checked) and remove the others.",
        ],
      },
      {
        h: "2. Ad requirements",
        list: [
          "A real property inside the Hashemite Kingdom of Jordan that is actually available, at the stated location, at its real price in Jordanian dinars.",
          "A property under construction (off-plan sale) must say so clearly in the title or description, with the expected delivery date, and comply with the regulations.",
          "A clear title and description that match the property, and the correct property type (land must not be listed as a flat, for example).",
          "Real photos of the property itself that you took or have the right to use; no photos from other ads or the internet, no photos with logos or watermarks of other platforms or offices, and no photos clearly showing people's faces, personal data or number plates.",
          "Update or withdraw the ad as soon as the property is sold or rented or any detail changes.",
        ],
      },
      {
        h: "3. Not allowed",
        list: [
          "Fake or misleading ads, or any unreal price to attract attention.",
          "Asking for a deposit, payment or money transfer before a viewing, or any payment request outside normal direct dealings.",
          "External links, phone numbers or e-mail addresses inside the title or description. Contact happens through the site's buttons only.",
          "Repeating the same ad or re-posting an ad removed for a breach.",
          "Illegal properties or dealings, or ads without the legal standing to offer the property, including land or units that cannot legally be sold or subdivided, and off-plan sales in breach of the regulations.",
          "Interior photos or the exact position of an occupied property without the occupant's consent.",
          "Offensive, discriminatory or hateful content, or content that breaches others' privacy or rights.",
          "Impersonating an owner, organisation or another person.",
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
        p: ["If your ad was rejected or removed and you think it was a mistake, write to {email} with the ad number and your explanation within [14] days of being told of the decision, and we will review it."],
      },
      {
        h: "4. False reports",
        p: [
          "False or repeated bad-faith reports breach our rules, may lead to account suspension, and may expose the reporter to legal liability. The number of reports per user is limited to prevent abuse.",
        ],
      },
      {
        h: "5. If you have been defrauded",
        p: ["Stop dealing immediately and transfer nothing, report the ad number to us, and contact the competent security authorities (such as the Cybercrime Unit of the Public Security Directorate). The platform is not a party to the dealing and cannot recover money, but we cooperate with the authorities as the law allows."],
      },
      {
        h: "6. Copyright and impersonation",
        p: [
          "If your photos, details, name or office name were published without permission, write to {email} with the ad number and proof of your right. We pause the ad within [24] hours of a complete report and let the advertiser respond.",
        ],
      },
      {
        h: "7. Evidence and requests from authorities",
        p: [
          "When an ad is removed on suspicion of a crime, we keep a copy of it and the related records to provide to the competent authorities on request.",
          "We handle requests from the public prosecution, courts or competent security authorities in accordance with the law, via {email} [or a dedicated address for authorities], and remove or block content at once when a competent order is issued.",
        ],
      },
    ],
  },
};
