import { useEffect, useState, useRef, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
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

interface MeetingDigest {
  id: string;
  title: string;
  overview: string;
  transcript?: string;
  created_at: string;
}

export default function ChapterDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [transcripts, setTranscripts] = useState<MeetingDigest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit mode state for Chapter
  const [isEditing, setIsEditing] = useState(false);
  const [chapterName, setChapterName] = useState("");
  const [chapterLocation, setChapterLocation] = useState("");
  const [progress, setProgress] = useState("Needs Training");
  const [progressNotes, setProgressNotes] = useState("");
  const [boardMembersInput, setBoardMembersInput] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Transcript upload state
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Transcript edit mode state
  const [editingDigestId, setEditingDigestId] = useState<string | null>(null);
  const [editDigestTitle, setEditDigestTitle] = useState("");
  const [editDigestOverview, setEditDigestOverview] = useState("");

  const fetchChapterData = async () => {
    if (!id) return;
    try {
      const { data: chapterData, error: chapterError } = await supabase
        .from("chapter_locations")
        .select(`
          *,
          person_chapter_locations (
            people (
              name
            )
          )
        `)
        .eq("id", id)
        .single();

      if (chapterError) throw chapterError;
      setChapter(chapterData);
      setChapterName(chapterData.name);
      setChapterLocation(chapterData.location || "");
      setProgress(chapterData.progress || "Needs Training");
      setProgressNotes(chapterData.progress_notes || "");

      const currentNames = chapterData.person_chapter_locations
        ?.map((item: any) => item.people?.name)
        .filter(Boolean)
        .join(", ") || "";
      setBoardMembersInput(currentNames);

      const { data: digestData, error: digestError } = await supabase
        .from("meeting_digests")
        .select("id, title, overview, created_at")
        .eq("location_id", id)
        .order("created_at", { ascending: false });

      if (digestError) throw digestError;
      setTranscripts(digestData || []);
    } catch (err: any) {
      console.error("Error loading chapter:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChapterData();
  }, [id]);

  const handleUpdateChapter = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setFormError("");
    setSubmitting(true);

    try {
      const { error: updateError } = await supabase
        .from("chapter_locations")
        .update({
          name: chapterName,
          location: chapterLocation,
          progress,
          progress_notes: progress === "Other" ? progressNotes : "",
        })
        .eq("id", id);

      if (updateError) throw updateError;

      const { error: deleteError } = await supabase
        .from("person_chapter_locations")
        .delete()
        .eq("location_id", id);

      if (deleteError) throw deleteError;

      if (boardMembersInput.trim()) {
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
                location_id: id
              }]);
          }
        }
      }

      setIsEditing(false);
      await fetchChapterData();
    } catch (err: any) {
      setFormError(err.message || "Failed to update chapter.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !id) return;

    setIsSummarizing(true);
    setUploadError("");

    try {
      const text = await file.text();
      const trimmed = text.trim();

      if (!trimmed) {
        throw new Error("The uploaded transcript is empty.");
      }

      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API key is missing from environment variables.");
      }

      const prompt = `Analyze this meeting transcript. Return a JSON object with two strictly named keys: "title" (a short title for the meeting) and "overview" (a summary of the meeting). Transcript: \n\n${trimmed}`;
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Gemini API Error Details:", errorData);
        throw new Error(`Gemini API Error (${response.status}). Check the console for details.`);
      }

      const aiData = await response.json();
      const generatedText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!generatedText) {
        throw new Error("Gemini returned an empty response.");
      }

      const { title, overview } = JSON.parse(generatedText);

      const { error: insertError } = await supabase
        .from("meeting_digests")
        .insert([{
          title: title || "Untitled Meeting",
          overview: overview || "No overview generated.",
          transcript: trimmed,
          location_id: id 
        }]);

      if (insertError) {
        throw new Error("Failed to save the meeting digest to the database: " + insertError.message);
      }

      await fetchChapterData();
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setUploadError(err.message || "An unexpected error occurred during upload.");
      console.error(err);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleDeleteTranscript = async (digestId: string) => {
    if (!window.confirm("Are you sure you want to delete this meeting summary?")) return;
    
    try {
      const { error } = await supabase
        .from("meeting_digests")
        .delete()
        .eq("id", digestId);

      if (error) throw error;
      setTranscripts(transcripts.filter((t) => t.id !== digestId));
    } catch (err: any) {
      alert("Error deleting summary: " + err.message);
    }
  };

  const startEditingTranscript = (digest: MeetingDigest) => {
    setEditingDigestId(digest.id);
    setEditDigestTitle(digest.title);
    setEditDigestOverview(digest.overview);
  };

  const handleSaveDigestEdit = async (digestId: string) => {
    try {
      const { error } = await supabase
        .from("meeting_digests")
        .update({
          title: editDigestTitle,
          overview: editDigestOverview,
        })
        .eq("id", digestId);

      if (error) throw error;

      setTranscripts(transcripts.map(t => 
        t.id === digestId 
          ? { ...t, title: editDigestTitle, overview: editDigestOverview } 
          : t
      ));
      setEditingDigestId(null);
    } catch (err: any) {
      alert("Error updating summary: " + err.message);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>Loading chapter...</div>;
  }

  if (!chapter) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <p>Chapter not found.</p>
        <button onClick={() => navigate("/dashboard")} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Back to Dashboard</button>
      </div>
    );
  }

  const boardMembersList = chapter.person_chapter_locations
    ?.map((item) => item.people?.name)
    .filter(Boolean)
    .join(", ") || "None assigned";

  return (
    <div style={{ minHeight: '100vh', background: '#f9f9fb', fontFamily: 'sans-serif', padding: '2rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <button 
          onClick={() => navigate("/dashboard")}
          style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', padding: 0, marginBottom: '1rem', fontSize: '0.875rem', fontWeight: 500 }}
        >
          ← Back to Dashboard
        </button>

        {/* Chapter Header & Info Card */}
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e4e4e7', marginBottom: '2rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', color: '#111' }}>{chapter.name}</h1>
              {chapter.location && <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: '#555' }}><strong>Location:</strong> {chapter.location}</p>}
              {chapter.progress && <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: '#555' }}><strong>Progress:</strong> {chapter.progress}</p>}
              {chapter.progress === "Other" && chapter.progress_notes && (
                <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: '#555' }}><strong>Notes:</strong> {chapter.progress_notes}</p>
              )}
              <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: '#555' }}><strong>Board Members:</strong> {boardMembersList}</p>
            </div>
            <button 
              onClick={() => setIsEditing(!isEditing)}
              style={{ padding: '0.4rem 0.75rem', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '4px', cursor: 'pointer', fontSize: '0.813rem', fontWeight: 500 }}
            >
              {isEditing ? 'Cancel Edit' : 'Edit Chapter'}
            </button>
          </div>

          {/* Edit Form */}
          {isEditing && (
            <form onSubmit={handleUpdateChapter} style={{ borderTop: '1px solid #e4e4e7', paddingTop: '1rem', marginTop: '1rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Edit Chapter Details</h3>
              {formError && <p style={{ color: 'red', fontSize: '0.875rem', marginBottom: '1rem' }}>{formError}</p>}
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', fontWeight: 500 }}>Chapter Name</label>
                <input 
                  type="text" 
                  value={chapterName} 
                  onChange={(e) => setChapterName(e.target.value)} 
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
                  placeholder="e.g., Jane Doe, John Smith" 
                  style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }} 
                />
              </div>

              <button 
                type="submit" 
                disabled={submitting}
                style={{ padding: '0.5rem 1rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}
        </div>

        {/* Transcripts Section */}
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#111' }}>Meeting Summaries & Transcripts</h2>
            <div>
              <input 
                type="file" 
                accept=".txt" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileUpload} 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isSummarizing}
                style={{ padding: '0.5rem 1rem', background: '#0066cc', color: '#fff', border: 'none', borderRadius: '4px', cursor: isSummarizing ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
              >
                {isSummarizing ? 'Summarizing...' : '+ Upload Transcript (.txt)'}
              </button>
            </div>
          </div>

          {uploadError && <p style={{ color: 'red', fontSize: '0.875rem', marginBottom: '1rem' }}>{uploadError}</p>}

          {transcripts.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: '#777', fontStyle: 'italic', margin: 0 }}>No meeting summaries recorded for this chapter yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {transcripts.map((item) => (
                <div key={item.id} style={{ background: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  
                  {editingDigestId === item.id ? (
                    <div>
                      <input 
                        value={editDigestTitle} 
                        onChange={(e) => setEditDigestTitle(e.target.value)} 
                        style={{ width: '100%', marginBottom: '0.5rem', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                        placeholder="Meeting Title"
                      />
                      <textarea 
                        value={editDigestOverview} 
                        onChange={(e) => setEditDigestOverview(e.target.value)} 
                        rows={4}
                        style={{ width: '100%', marginBottom: '0.5rem', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                        placeholder="Meeting Overview"
                      />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          onClick={() => handleSaveDigestEdit(item.id)}
                          style={{ padding: '0.4rem 0.75rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.813rem', fontWeight: 500 }}
                        >
                          Save
                        </button>
                        <button 
                          onClick={() => setEditingDigestId(null)}
                          style={{ padding: '0.4rem 0.75rem', background: '#f1f1f3', color: '#333', border: '1px solid #d4d4d8', borderRadius: '4px', cursor: 'pointer', fontSize: '0.813rem', fontWeight: 500 }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a' }}>{item.title || 'Untitled Meeting'}</h3>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(item.created_at).toLocaleDateString()}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            onClick={() => startEditingTranscript(item)}
                            style={{ padding: '0.25rem 0.5rem', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteTranscript(item.id)}
                            style={{ padding: '0.25rem 0.5rem', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#334155', lineHeight: '1.5' }}>
                        {item.overview || 'No summary available.'}
                      </p>
                    </div>
                  )}
                  
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}