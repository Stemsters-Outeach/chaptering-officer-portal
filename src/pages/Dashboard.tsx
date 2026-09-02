import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface Chapter {
  id: string;
  name: string;
  location?: string;
  progress?: string;
  progress_notes?: string;
  created_at: string;
  person_chapter_locations?: {
    people: {
      name: string;
    } | null;
  }[];
}

export default function Dashboard() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [isAdding, setIsAdding] = useState(false);
  const [chapterName, setChapterName] = useState("");
  const [chapterLocation, setChapterLocation] = useState("");
  const [progress, setProgress] = useState("Needs Training");
  const [progressNotes, setProgressNotes] = useState("");
  const [boardMembersInput, setBoardMembersInput] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  const navigate = useNavigate();

  const fetchChapters = async () => {
    try {
      const { data, error } = await supabase
        .from("chapter_locations")
        .select(`
          *,
          person_chapter_locations (
            people (
              name
            )
          )
        `);

      if (error) throw error;
      setChapters(data || []);
    } catch (err: any) {
      console.error("Error fetching chapters:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }
      setUserEmail(user.email ?? "Officer");
      setUserId(user.id);
      await fetchChapters();
    }

    init();
  }, [navigate]);

  const resetForm = () => {
    setChapterName("");
    setChapterLocation("");
    setProgress("Needs Training");
    setProgressNotes("");
    setBoardMembersInput("");
    setIsAdding(false);
    setFormError("");
  };

  const handleSaveChapter = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    if (!userId) {
      setSubmitting(false);
      return;
    }

    try {
      const { data: chapterData, error } = await supabase
        .from("chapter_locations")
        .insert([
          {
            name: chapterName,
            location: chapterLocation,
            progress,
            progress_notes: progress === "Other" ? progressNotes : "",
            officer_id: userId,
          }
        ])
        .select()
        .single();

      if (error) throw error;

      if (boardMembersInput.trim() && chapterData) {
        const names = boardMembersInput.split(",").map(n => n.trim()).filter(n => n.length > 0);
        
        for (const name of names) {
          const { data: personData, error: personError } = await supabase
            .from("people")
            .insert([{ name }])
            .select()
            .single();

          if (!personError && personData) {
            await supabase
              .from("person_chapter_locations")
              .insert([{
                person_id: personData.id,
                location_id: chapterData.id
              }]);
          }
        }
      }

      resetForm();
      await fetchChapters();
    } catch (err: any) {
      setFormError(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteChapter = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this chapter?")) return;

    try {
      const { error } = await supabase
        .from("chapter_locations")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setChapters(chapters.filter((ch) => ch.id !== id));
    } catch (err: any) {
      alert("Error deleting chapter: " + err.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>Loading dashboard...</div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9f9fb', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', background: '#fff', borderBottom: '1px solid #e4e4e7' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', color: '#111' }}>Chaptering Officer Portal</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.875rem', color: '#555' }}>{userEmail}</span>
          <button 
            onClick={handleLogout}
            style={{ padding: '0.5rem 1rem', background: '#f1f1f3', border: '1px solid #d4d4d8', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
          >
            Sign Out
          </button>
        </div>
      </header>

      <main style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#222' }}>Your Chapters</h2>
          <button 
            onClick={() => {
              if (isAdding) {
                resetForm();
              } else {
                setIsAdding(true);
              }
            }}
            style={{ padding: '0.5rem 1rem', background: '#0066cc', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
          >
            {isAdding ? 'Cancel' : '+ Add Chapter'}
          </button>
        </div>

        {isAdding && (
          <form onSubmit={handleSaveChapter} style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e4e4e7', marginBottom: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Add New Chapter & Board Details</h3>
            {formError && <p style={{ color: 'red', fontSize: '0.875rem', marginBottom: '1rem' }}>{formError}</p>}
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', fontWeight: 500 }}>Chapter Name</label>
              <input 
                type="text" 
                value={chapterName} 
                onChange={(e) => setChapterName(e.target.value)} 
                placeholder="e.g., Arcadia High School" 
                required 
                style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }} 
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', fontWeight: 500 }}>Location</label>
              <input 
                type="text" 
                value={chapterLocation} 
                onChange={(e) => setChapterLocation(e.target.value)} 
                placeholder="e.g., Arcadia, California" 
                required 
                style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }} 
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', fontWeight: 500 }}>Progress Status</label>
              <select 
                value={progress} 
                onChange={(e) => setProgress(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', background: '#fff' }}
              >
                <option value="Needs Training">Needs Training</option>
                <option value="Researching">Researching</option>
                <option value="Teaching">Teaching</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {progress === "Other" && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', fontWeight: 500 }}>Other Progress Notes</label>
                <textarea 
                  value={progressNotes} 
                  onChange={(e) => setProgressNotes(e.target.value)} 
                  placeholder="Describe the current progress..." 
                  rows={3}
                  style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }} 
                />
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', fontWeight: 500 }}>Board Members (comma separated)</label>
              <input 
                type="text" 
                value={boardMembersInput} 
                onChange={(e) => setBoardMembersInput(e.target.value)} 
                placeholder="e.g., Jane Doe, John Smith, Mary Wells" 
                style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }} 
              />
            </div>

            <button 
              type="submit" 
              disabled={submitting}
              style={{ padding: '0.5rem 1rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
            >
              {submitting ? 'Saving...' : 'Save Chapter'}
            </button>
          </form>
        )}

        {chapters.length === 0 ? (
          <div style={{ background: '#fff', padding: '2rem', borderRadius: '8px', border: '1px solid #e4e4e7', textAlign: 'center', color: '#666' }}>
            <p>No chapters found.</p>
            <p style={{ fontSize: '0.875rem' }}>Click the <strong>+ Add Chapter</strong> button above to create your first entry.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {chapters.map((chapter) => {
              const boardMembersList = chapter.person_chapter_locations
                ?.map((item) => item.people?.name)
                .filter(Boolean)
                .join(", ") || "None assigned";

              return (
                <div 
                  key={chapter.id} 
                  onClick={() => navigate(`/chapters/${chapter.id}`)}
                  style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', cursor: 'pointer', transition: 'border-color 0.2s' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ margin: '0 0 0.5rem 0', color: '#0066cc' }}>{chapter.name}</h3>
                      {chapter.location && <p style={{ margin: '0.25rem 0', fontSize: '0.875rem', color: '#444' }}><strong>Location:</strong> {chapter.location}</p>}
                      {chapter.progress && <p style={{ margin: '0.25rem 0', fontSize: '0.875rem', color: '#444' }}><strong>Progress:</strong> {chapter.progress}</p>}
                      {chapter.progress === "Other" && chapter.progress_notes && (
                        <p style={{ margin: '0.25rem 0', fontSize: '0.875rem', color: '#666' }}><strong>Notes:</strong> {chapter.progress_notes}</p>
                      )}
                      <p style={{ margin: '0.25rem 0', fontSize: '0.875rem', color: '#444' }}><strong>Board Members:</strong> {boardMembersList}</p>
                      <p style={{ margin: '0.25rem 0', fontSize: '0.813rem', color: '#888' }}>Created: {new Date(chapter.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteChapter(chapter.id);
                        }}
                        style={{ padding: '0.4rem 0.75rem', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer', fontSize: '0.813rem', fontWeight: 500 }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}