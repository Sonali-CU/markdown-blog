const express = require('express');
const router = express.Router();
const { User, Post } = require('../models');

// View a user's profile
router.get('/:username', async (req, res) => {
  const user = await User.findOne({
    where: { username: req.params.username },
    attributes: ['username', 'display_name', 'bio', 'avatar_url']
  });

  if (!user) return res.status(404).json({ error: 'User not found' });

  const posts = await Post.findAll({
    where: { author_id: user.id, published: true }
  });

  res.json({ user, posts });
});

module.exports = router;
