import LegalPage, { Section } from "../LegalPage";

export const metadata = {
  title: "Privacy Policy - aiDexer",
  description: "How aiDexer handles information when you use the website.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="August 30, 2026">
      <Section heading="1. What This Site Does">
        <p>
          aiDexer is a directory that helps you find AI tools. You can browse tools by category or
          use the search box (AI Mode) to describe a task and get matched to relevant tools. The
          Site links out to third-party AI tools; it does not host, run, or operate those tools
          itself.
        </p>
      </Section>

      <Section heading="2. Information We Collect">
        <p className="mb-2">
          <strong>Search input.</strong> When you type into the AI Mode box, that text is processed
          to return matching results. We do not require you to create an account or submit personal
          details (name, email, payment info) to use the Site.
        </p>
        <p className="mb-2">
          <strong>Standard hosting logs.</strong> Like most websites, the Site runs on hosting
          infrastructure that automatically records basic technical data (such as IP address,
          browser type, and access times) for security and performance purposes. This is standard
          server-level logging, not something we actively collect through forms on the Site.
        </p>
        <p>
          We do not currently have a login system, payment processing, or account creation on the
          Site. If that changes, this policy will be updated to reflect what&apos;s actually
          collected.
        </p>
      </Section>

      <Section heading="3. How We Use Information">
        <ul>
          <li>To return relevant tool matches when you search or use AI Mode</li>
          <li>To keep the Site running securely and to diagnose technical issues</li>
          <li>We do not sell your search queries or hosting log data to third parties</li>
        </ul>
      </Section>

      <Section heading="4. Third-Party Links">
        <p>
          Every AI tool listed on this Site links to that tool&apos;s own website. Once you click
          through, you are subject to that tool&apos;s own privacy policy and terms, not ours. We do
          not control, and are not responsible for, how third-party tools handle your data.
        </p>
      </Section>

      <Section heading="5. Cookies">
        <p>
          The Site may use basic cookies or similar technology provided by the hosting platform for
          functionality and performance. We do not use this to build advertising profiles.
        </p>
      </Section>

      <Section heading="6. Data Retention">
        <p>
          We do not retain search queries beyond what&apos;s needed to return results in that
          session, unless otherwise stated here in a future update.
        </p>
      </Section>

      <Section heading="7. Changes to This Policy">
        <p>
          If the Site adds features that involve collecting more information (accounts,
          newsletters, payments, etc.), this policy will be updated before those features go live.
        </p>
      </Section>

      <Section heading="8. Contact">
        <p>
          Questions about this policy can be sent to:{" "}
          <a
            href="mailto:michaelwassie4447@gmail.com"
            className="text-neutral-900 dark:text-neutral-100 font-medium underline underline-offset-2"
          >
            michaelwassie4447@gmail.com
          </a>
        </p>
      </Section>
    </LegalPage>
  );
}