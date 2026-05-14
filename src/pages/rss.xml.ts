export const prerender = true;
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

// Hand-curated Learn articles. Each one is its own Astro page (not a content
// collection), so we list them here. Add new entries when a new Learn page ships.
const learnArticles = [
  {
    title: 'AWS Organizational Policy Controls — interactive simulator',
    description:
      'A live simulator for AWS Service Control Policies, Resource Control Policies, and the Data Perimeter pattern. Click six trust scenarios and watch which gate blocks each one, with deep-dive docs on AWS policy evaluation, SCPs, and RCPs.',
    link: '/learn/aws-organizational-policies/',
    pubDate: new Date('2026-05-07'),
    categories: ['interactive', 'aws', 'scp', 'rcp', 'data-perimeter'],
  },
  {
    title: 'Cloud Hardening as a Proactive Defense Against Adversarial AI',
    description:
      'A walk-through of a live AI-driven AWS attack, the four shifts that made it possible, and the three architectural gaps it exploits — tenancy, perimeter, blast radius — with the AWS-native primitives that close them. Adapted from a talk at the AWS Meetup, May 2026.',
    link: '/learn/cloud-architecture-gaps/',
    pubDate: new Date('2026-05-07'),
    categories: ['cloud-architecture', 'aws', 'data-perimeter', 'iam', 'blast-radius'],
  },
];

export async function GET(context: APIContext) {
  const blogPosts = await getCollection('blog');

  const blogItems = blogPosts.map(p => ({
    title: p.data.title,
    description: p.data.description,
    pubDate: p.data.publishDate,
    link: `/blog/${p.slug}/`,
    categories: p.data.tags,
  }));

  const learnItems = learnArticles.map(a => ({
    title: a.title,
    description: a.description,
    pubDate: a.pubDate,
    link: a.link,
    categories: a.categories,
  }));

  const items = [...blogItems, ...learnItems].sort(
    (a, b) => b.pubDate.valueOf() - a.pubDate.valueOf()
  );

  return rss({
    title: 'InstaSecure',
    description:
      'Field guides on cloud security architecture and writing from the team building InstaSecure — preventive AWS guardrails, IAM, data perimeter, and the architectural problems behind real cloud breaches.',
    site: context.site!.toString(),
    items,
    customData: `<language>en-us</language>`,
  });
}
