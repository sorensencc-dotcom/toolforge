import React, { useState } from 'react';

const CATEGORIES = [
  { id: '', label: 'All Categories' },
  { id: 'linting', label: 'Linting' },
  { id: 'auth', label: 'Auth' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'deployment', label: 'Deployment' },
  { id: 'testing', label: 'Testing' },
  { id: 'devtools', label: 'DevTools' },
  { id: 'security', label: 'Security' },
];

export default function SearchBar({ onSearch, onCategoryChange }) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(query);
  };

  const handleCategorySelect = (cat) => {
    onCategoryChange(cat);
  };

  return (
    <div className="search-bar">
      <form onSubmit={handleSubmit} className="search-form">
        <input
          type="text"
          placeholder="Search skills..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search-input"
        />
        <button type="submit" className="search-button">Search</button>
      </form>

      <div className="category-filter">
        <label>Filter by category:</label>
        <div className="category-buttons">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat.id)}
              className="category-btn"
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
