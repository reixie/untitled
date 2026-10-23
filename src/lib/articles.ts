import { getCollection, type CollectionEntry } from 'astro:content';

type Article = CollectionEntry<'articles'>;
export type PublishedArticle = Article & {
  data: Extract<Article['data'], { status: 'published' }>;
};

/** Use for both future route generation and listings. Draft source remains public. */
export async function getPublishedArticles(): Promise<PublishedArticle[]> {
  const articles = await getCollection('articles');

  return articles
    .filter(
      (article): article is PublishedArticle =>
        article.data.status === 'published',
    )
    .sort((a, b) => {
      const byDate =
        b.data.publishedAt.getTime() - a.data.publishedAt.getTime();
      return byDate || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
}
