import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = await getCollection('blog');
  return rss({
    title: 'InstaSecure Blog',
    description: 'Writing on preventive cloud security, AWS IAM, and the InstaSecure platform — from the team building the product.',
    site: context.site!.toString(),
    items: posts
      .sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf())
      .map(p => ({
        title: p.data.title,
        description: p.data.description,
        pubDate: p.data.publishDate,
        link: `/blog/${p.slug}/`,
        categories: p.data.tags,
      })),
    customData: `<language>en-us</language>`,
  });
}
