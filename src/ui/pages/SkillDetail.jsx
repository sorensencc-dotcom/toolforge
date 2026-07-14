import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function SkillDetail({ skillId, onBack }) {
  const [skill, setSkill] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState(null);

  useEffect(() => {
    fetchSkillDetail();
  }, [skillId]);

  const fetchSkillDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const [skillRes, versionsRes] = await Promise.all([
        axios.get(`/api/v1/skills/${skillId}`),
        axios.get(`/api/v1/skills/${skillId}/versions`),
      ]);
      setSkill(skillRes.data.data);
      setVersions(versionsRes.data.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load skill details');
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async () => {
    if (!versions.length) {
      setInstallStatus('No versions available');
      return;
    }

    setInstalling(true);
    setInstallStatus(null);
    try {
      // Simulate installation (would call a backend endpoint)
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setInstallStatus('✓ Installation successful!');
    } catch (err) {
      setInstallStatus('✗ Installation failed: ' + (err.message || 'Unknown error'));
    } finally {
      setInstalling(false);
    }
  };

  if (loading) {
    return (
      <div className="skill-detail-container">
        <button onClick={onBack} className="back-button">×</button>
        <div className="loading">Loading skill details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="skill-detail-container">
        <button onClick={onBack} className="back-button">×</button>
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!skill) {
    return (
      <div className="skill-detail-container">
        <button onClick={onBack} className="back-button">×</button>
        <div className="empty-state">Skill not found</div>
      </div>
    );
  }

  const rating = skill.rating || { average: 0, count: 0 };
  const avgScore = rating.average ? parseFloat(rating.average).toFixed(1) : 'N/A';

  return (
    <div className="skill-detail-container">
      <button onClick={onBack} className="back-button">×</button>

      <div className="skill-detail">
        <span className="category-badge">{skill.category?.toUpperCase()}</span>
        <div className="skill-detail-header">
          {skill.icon_url && (
            <img src={skill.icon_url} alt={skill.name} className="skill-detail-icon" />
          )}
          <div>
            <h1>{skill.name}</h1>
            <p className="skill-owner">By {skill.owner}</p>
          </div>
        </div>

        <div className="skill-meta">
          <div className="meta-item">
            <label>Category</label>
            <span className="category-badge">{skill.category}</span>
          </div>
          <div className="meta-item">
            <label>Status</label>
            <span>{skill.status}</span>
          </div>
          <div className="meta-item">
            <label>Rating</label>
            <span className="rating-value">★ {avgScore} ({rating.count} reviews)</span>
          </div>
        </div>

        <section className="skill-section">
          <h2>Description</h2>
          <p>{skill.description}</p>
        </section>

        {versions.length > 0 && (
          <section className="skill-section">
            <h2>Versions</h2>
            <div className="versions-list">
              {versions.slice(0, 5).map((v) => (
                <div key={v.id} className="version-item">
                  <span className="version-tag">{v.version_tag}</span>
                  <span className="version-date">{new Date(v.release_date).toLocaleDateString()}</span>
                  {v.changelog && <p className="version-changelog">{v.changelog}</p>}
                </div>
              ))}
              {versions.length > 5 && <p className="more-versions">+{versions.length - 5} more versions</p>}
            </div>
          </section>
        )}

        <div className="skill-actions">
          <button
            onClick={handleInstall}
            disabled={installing}
            className="install-button"
          >
            {installing ? 'INSTALLING...' : 'INSTALL'}
          </button>
          {installStatus && (
            <div className={`install-status ${installStatus.startsWith('✓') ? 'success' : 'error'}`}>
              {installStatus}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
