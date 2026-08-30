import LegalPage, { Section } from "../LegalPage";

export const metadata = {
  title: "Terms of Service - aiDexer",
  description: "The terms that apply when you use aiDexer.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="August 30, 2026">
      <Section heading="1. What the Site Is">
        <p>
          aiDexer is a directory of AI tools. It lets you browse tools by category (General
          Purpose, Coding, Image Generation, Marketing/Writing, Productivity, Research, Video,
          Audio, Presentations, Development Platform, and more) and use a search feature (AI Mode)
          where you describe a task in your own words to get matched to relevant tools.
        </p>
      </Section>

      <Section heading="2. Not an Endorsement">
        <p>
          Listings on the Site are for informational purposes to help you discover tools. Inclusion
          of a tool on this Site is not an endorsement, guarantee, or recommendation that it is the
          right choice for your specific use case. You are responsible for evaluating any tool
          before you use it.
        </p>
      </Section>

      <Section heading="3. Third-Party Tools">
        <p>
          The Site links out to third-party AI tools (for example, ChatGPT, Claude, GitHub Copilot,
          Midjourney, and others). We do not build, operate, or control these tools. Once you leave
          the Site by clicking a listing, your use of that tool is governed entirely by that
          tool&apos;s own terms, pricing, and policies. We are not responsible for the accuracy of
          pricing, features, or availability listed for third-party tools, as these can change
          without notice.
        </p>
      </Section>

      <Section heading="4. Accuracy of Listings">
        <p>
          We aim to keep tool descriptions, categories, and pricing information reasonably up to
          date, but the AI tool landscape changes quickly. We do not guarantee that every listing
          is current or complete. If you notice outdated or incorrect information, you&apos;re
          welcome to reach out.
        </p>
      </Section>

      <Section heading="5. Use of the Site">
        <p>
          You agree to use the Site only for its intended purpose: browsing and searching for AI
          tools. You agree not to misuse the Site, including attempting to disrupt its operation,
          scrape it at scale without permission, or use the AI Mode search to submit harmful or
          abusive content.
        </p>
      </Section>

      <Section heading="6. No Warranty">
        <p>
          The Site is provided &quot;as is,&quot; without warranties of any kind. We do not
          guarantee the Site will be error-free, uninterrupted, or that the tool matches provided
          through AI Mode will be suitable for your needs.
        </p>
      </Section>

      <Section heading="7. Limitation of Liability">
        <p>
          To the extent permitted by law, aiDexer is not liable for any damages arising from your
          use of the Site or your use of any third-party tool discovered through the Site.
        </p>
      </Section>

      <Section heading="8. Changes to the Site or Terms">
        <p>
          Features on the Site (categories, search behavior, listings) may change as it develops.
          These Terms may be updated to reflect that, and continued use of the Site after updates
          means you accept the revised Terms.
        </p>
      </Section>

      <Section heading="9. Contact">
        <p>
          Questions about these Terms can be sent to:{" "}
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