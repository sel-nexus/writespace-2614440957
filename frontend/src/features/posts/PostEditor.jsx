/** Share a required-field plain-text editor between creation and owned-post editing. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { styles } from '../identity/auth.js';
import { canManagePost, createPost, getPost, updatePost } from './postService.js';

/** Prefill edits and persist only explicit successful submissions.
 * @param {object} props Current session and explicit create/edit mode matching the route.
 * @returns {JSX.Element} Editor, missing state, or unauthorized redirect.
 */
export default function PostEditor({ session = null, mode = 'create' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = mode === 'edit';
  const post = editing ? getPost(id) : null;
  const [title, setTitle] = useState(post?.title ?? '');
  const [content, setContent] = useState(post?.content ?? '');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    const current = mode === 'edit' ? getPost(id) : null;
    setTitle(current?.title ?? '');
    setContent(current?.content ?? '');
    setErrors({});
    setError('');
  }, [id, mode]);

  /** Associate validation failures with fields and remain on the form on any failed save. */
  function save(event) {
    event.preventDefault();
    setErrors({});
    setError('');
    try {
      const saved = editing ? updatePost(id, { title, content }) : createPost({ title, content });
      navigate(`/blog/${encodeURIComponent(saved.id)}`);
    } catch (failure) {
      setErrors(failure.fieldErrors ?? {});
      setError(failure.fieldErrors ? '' : failure.message);
    }
  }

  if (editing && !post) {
    return (
      <section className="space-y-6">
        <h1 className={styles.heading}>
          Post not found
        </h1>
        <Link to="/blogs" className={styles.secondary}>
          Back to All Posts
        </Link>
      </section>
    );
  }
  if (editing && (!session || !canManagePost(post))) {
    return (
      <Navigate to="/blogs" replace />
    );
  }

  return (
    <section className="mx-auto max-w-3xl">
      <h1 className={styles.heading}>
        {editing ? 'Edit Post' : 'Write a Post'}
      </h1>
      <p className="mb-8 mt-3 text-slate-600">
        Your words, saved in this browser. Plain text only.
      </p>
      <form onSubmit={save} noValidate className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div>
          <label htmlFor="post-title" className="font-medium">
            Title
          </label>
          <input
            id="post-title" type="text" value={title} onChange={event => setTitle(event.target.value)}
            aria-required="true" aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? 'post-title-error' : undefined} className={styles.input}
          />
          {errors.title && (
            <p id="post-title-error" role="alert" className={styles.error}>
              {errors.title}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="post-content" className="font-medium">
            Content
          </label>
          <textarea
            id="post-content" value={content} onChange={event => setContent(event.target.value)}
            aria-required="true" aria-invalid={Boolean(errors.content)}
            aria-describedby={errors.content ? 'post-content-error post-counter' : 'post-counter'}
            className={`${styles.input} min-h-64 resize-y leading-relaxed`}
          />
          <p id="post-counter" className="mt-2 text-right text-sm tabular-nums text-slate-600">
            {content.length} characters
          </p>
          {errors.content && (
            <p id="post-content-error" role="alert" className={styles.error}>
              {errors.content}
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={styles.primary}>
            Save
          </button>
          <Link to={editing ? `/blog/${encodeURIComponent(id)}` : '/blogs'} className={styles.ghost}>
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}

PostEditor.propTypes = {
  session: PropTypes.shape({ userId: PropTypes.string, role: PropTypes.oneOf(['admin', 'user']) }),
  mode: PropTypes.oneOf(['create', 'edit']),
};
