// routes/posts.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Post, User } = require('../models');
const slugify = require('slugify');
const marked = require('marked');
const sanitizeHtml = require('sanitize-html');

async function makeUniqueSlug(base) {
  let baseSlug = slugify(base || 'post', { lower: true, strict: true });
  if (!baseSlug) baseSlug = 'post';
  let slug = baseSlug;
  let i = 1;
  while (await Post.findOne({ where: { slug } })) {
    slug = `${baseSlug}-${i++}`;
  }
  return slug;
}

// Public list - only published posts
router.get('/', async (req, res) => {
  try {
    const posts = await Post.findAll({
      where: { published: true },
      include: [{ model: User, attributes: ['id', 'username', 'display_name'] }],
      order: [['created_at', 'DESC']]
    });
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

// Public single by slug
router.get('/:slug', async (req, res) => {
  try {
    const post = await Post.findOne({
      where: { slug: req.params.slug, published: true },
      include: [{ model: User, attributes: ['id', 'username', 'display_name'] }]
    });
    if (!post) return res.status(404).json({ error: 'not_found' });
    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

// Create post (auth required) - if published:false => draft
router.post('/', auth, async (req, res) => {
  try {
    const { title, content, published, cover_image } = req.body;
    if (!title || typeof content !== 'string') {
      return res.status(400).json({ error: 'Missing title or content' });
    }

    const html = sanitizeHtml(marked.parse(content), {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2']),
      allowedAttributes: { a: ['href', 'name', 'target'], img: ['src', 'alt'] }
    });

    const slug = await makeUniqueSlug(title);

    const post = await Post.create({
      author_id: req.user.id,
      title,
      slug,
      content,
      html_content: html,
      published: !!published,
      is_draft: !published,
      cover_image: cover_image || null
    });

    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

// Update post (auth required)
// send { title, content, published, saveAsDraft, cover_image }
router.put('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'not_found' });
    if (post.author_id !== req.user.id) return res.status(403).json({ error: 'forbidden' });

    const { title, content, published, saveAsDraft, cover_image } = req.body;
    if (title && title !== post.title) {
      post.title = title;
      post.slug = await makeUniqueSlug(title);
    }
    if (typeof content === 'string') {
      post.content = content;
      post.html_content = sanitizeHtml(marked.parse(content), {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2']),
        allowedAttributes: { a: ['href', 'name', 'target'], img: ['src', 'alt'] }
      });
    }
    if (cover_image) post.cover_image = cover_image;
    if (typeof published === 'boolean') {
      post.published = published;
      post.is_draft = !published;
    } else if (saveAsDraft === true) {
      post.published = false;
      post.is_draft = true;
    }
    await post.save();
    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

// Current user's posts (drafts + published)
router.get('/me/all', auth, async (req, res) => {
  try {
    const posts = await Post.findAll({
      where: { author_id: req.user.id },
      order: [['updated_at', 'DESC']]
    });
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;

