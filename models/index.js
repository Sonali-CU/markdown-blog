// models/index.js
const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const dbHost = process.env.DB_HOST || '127.0.0.1';
const dbPort = process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432;
const dbUser = process.env.DB_USER || 'bloguser';
const dbPass = process.env.DB_PASS || 'pass';
const dbName = process.env.DB_NAME || 'blogdb';
const useSsl = (process.env.DB_SSL === 'true');

const sequelize = new Sequelize(dbName, dbUser, dbPass, {
  host: dbHost,
  port: dbPort,
  dialect: 'postgres',
  logging: false,
  dialectOptions: useSsl ? {
    ssl: {
      require: true,
      // For many RDS setups rejectUnauthorized:false is fine.
      // For stricter security, provide CA certificate and set rejectUnauthorized:true.
      rejectUnauthorized: false
    }
  } : {}
});

// Models
const User = sequelize.define('User', {
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password_hash: { type: DataTypes.STRING, allowNull: false },
  display_name: { type: DataTypes.STRING, allowNull: true }
}, {
  tableName: 'users',
  underscored: true,
  timestamps: true
});

const Post = sequelize.define('Post', {
  author_id: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  slug: { type: DataTypes.STRING, allowNull: false, unique: true },
  content: { type: DataTypes.TEXT, allowNull: false },
  html_content: { type: DataTypes.TEXT },
  published: { type: DataTypes.BOOLEAN, defaultValue: false },
  is_draft: { type: DataTypes.BOOLEAN, defaultValue: true },
  cover_image: { type: DataTypes.STRING, allowNull: true } // publicUrl to S3
}, {
  tableName: 'posts',
  underscored: true,
  timestamps: true
});

// Associations
User.hasMany(Post, { foreignKey: 'author_id', onDelete: 'CASCADE' });
Post.belongsTo(User, { foreignKey: 'author_id' });

module.exports = { sequelize, Sequelize, User, Post };

