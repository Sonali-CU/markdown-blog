// public/app.js
// SPA using React (CDN) - supports S3 presigned uploads, drafts, strong password UI, captcha (math), login by email/username.
// IMPORTANT: backend endpoints required: /api/auth (signup/login), /api/posts (POST, PUT, GET), /api/me/posts (GET), /api/upload-url (POST)

const e = React.createElement;
const { useState, useEffect } = React;
const apiBase = '/api';
const markedParser = window.marked;
markedParser.setOptions({ mangle:false, headerIds:true });

// small helpers
function saveToken(token) { if(token) localStorage.setItem('jwt_token', token); }
function readToken(){ return localStorage.getItem('jwt_token'); }
function clearToken(){ localStorage.removeItem('jwt_token'); }
function authFetch(url, opts = {}) {
  const token = readToken();
  opts.headers = opts.headers || {};
  if(token) opts.headers['Authorization'] = 'Bearer ' + token;
  return fetch(url, opts);
}
function goTo(route){ location.hash = route; }

// password strength check (same regex as backend should also enforce)
function passwordStrengthScore(pw){
  let score = 0;
  if(!pw) return score;
  if(pw.length >= 8) score++;
  if(/[A-Z]/.test(pw)) score++;
  if(/[a-z]/.test(pw)) score++;
  if(/\d/.test(pw)) score++;
  if(/[@$!%*?&.#^()_\-+=]/.test(pw)) score++;
  return score; // 0..5
}
function strengthColor(score){
  if(score <= 1) return '#ef4444';
  if(score === 2) return '#f59e0b';
  if(score === 3) return '#f59e0b';
  if(score === 4) return '#60a5fa';
  return '#16a34a';
}
function strengthLabel(score){
  if(score <= 1) return 'Very weak';
  if(score === 2) return 'Weak';
  if(score === 3) return 'Okay';
  if(score === 4) return 'Strong';
  return 'Very strong';
}

// Router
function Router(){
  const [route, setRoute] = useState(location.hash.slice(1) || '/');
  useEffect(()=>{
    function onHash(){ setRoute(location.hash.slice(1) || '/'); }
    window.addEventListener('hashchange', onHash);
    return ()=> window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(()=> {
    const nav = document.getElementById('nav-status');
    nav.innerText = readToken() ? 'Logged in' : 'Not logged in';
  });
  if(route === '/') return e(Intro);
  if(route === '/auth') return e(AuthPage);
  if(route === '/editor') return e(EditorPage);
  if(route === '/posts') return e(PostsPage);
  if(route.startsWith('/post/')) {
    const slug = route.replace('/post/','');
    return e(PostOpen, { slug });
  }
  return e(Intro);
}

// ----- Intro -----
function Intro(){
  return e('div', { className:'card intro' },
    e('div', { style:{flex:1} },
      e('h2', null, 'Write. Preview. Publish.'),
      e('p', null, 'A clean, secure Markdown blogging app — sign up, write drafts, upload images and publish.' ),
      e('div', { style:{display:'flex', gap:10, marginTop:12} },
        e('button', { className:'btn primary', onClick: ()=>goTo('/editor') }, 'Start Writing'),
        e('button', { className:'btn', onClick: ()=>goTo('/auth') }, 'Login / Sign Up')
      ),
      e('p', { className:'small', style:{marginTop:10} }, 'Published posts are public. Drafts are private to your account.')
    ),
    e('div', { style:{flex:'0 0 340px'} },
      e('div', { className:'card hero-graphics' }, 'Your blog, your voice')
    )
  );
}

// ----- Auth page (signup / login) -----
function AuthPage(){
  const [mode,setMode] = useState('login'); // login / signup
  const [username,setUsername] = useState('');
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [msg,setMsg] = useState('');
  const [showPwd,setShowPwd] = useState(false);

  // simple arithmetic captcha for signup
  const [capA,setCapA] = useState(0);
  const [capB,setCapB] = useState(0);
  const [capAnswer,setCapAnswer] = useState('');
  useEffect(()=> { if(mode==='signup'){ setCapA(1+Math.floor(Math.random()*8)); setCapB(1+Math.floor(Math.random()*8)); } }, [mode]);

  async function doSignup(e){
    e && e.preventDefault();
    setMsg('');
    const score = passwordStrengthScore(password);
    if(score < 4){
      setMsg('Password is not strong enough. Please meet all requirements (8+, upper, lower, number, special).');
      return;
    }
    // captcha check
    if(parseInt(capAnswer,10) !== (capA + capB)){
      setMsg('Captcha incorrect. Please solve the math captcha.');
      return;
    }
    try {
      const res = await fetch(apiBase + '/auth/signup', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ username, email, password })
      });
      const j = await res.json();
      if(j.error) setMsg('Error: ' + (Array.isArray(j.error) ? j.error.join(', ') : j.error));
      else { setMsg('Signup success — please login.'); setMode('login'); setPassword(''); setCapAnswer(''); }
    } catch(err){ setMsg('Network error'); }
  }

  async function doLogin(e){
    e && e.preventDefault();
    setMsg('');
    try {
      // Login supports email OR username — backend must accept { identifier, password }
      const res = await fetch(apiBase + '/auth/login', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ identifier: (email || username), password })
      });
      const j = await res.json();
      if(j.error) setMsg('Error: ' + j.error);
      else { saveToken(j.token); setMsg('Logged in'); goTo('/editor'); setTimeout(()=>location.reload(),250); }
    } catch(err) { setMsg('Network error'); }
  }

  const score = passwordStrengthScore(password);
  const scColor = strengthColor(score);
  const scLabel = strengthLabel(score);

  return e('div', { className:'card' },
    e('h2', null, mode === 'login' ? 'Login' : 'Sign Up'),
    e('form', { onSubmit: mode==='login' ? doLogin : doSignup },
      mode === 'signup' && e('div', { className:'form-row' },
        e('input', { placeholder:'Username', value:username, onChange: e=>setUsername(e.target.value), required:true })
      ),

      e('div', { className:'form-row' },
        e('input', { placeholder:'Email (or username for login)', type:'text', value:email, onChange: e=>setEmail(e.target.value), required: mode==='signup' })
      ),

      e('div', { className:'form-row', style:{position:'relative'} },
        e('input', { placeholder:'Password', type: showPwd ? 'text' : 'password', value:password, onChange: e=>setPassword(e.target.value), required:true }),
        e('span', { className:'eye', title:'Toggle password', onClick: ()=>setShowPwd(s=>!s) },
          e('i', { 'data-feather':'eye' })
        )
      ),

      mode === 'signup' && e('div', { style:{marginBottom:8} },
        e('div', { className:'small' }, 'Password strength: ', e('strong', { style:{color:scColor} }, scLabel)),
        e('div', { className:'meter', style:{marginTop:6} },
          e('i', { style:{width: (score/5*100) + '%', background: scColor }})
        ),
        e('div', { className:'small', style:{marginTop:8} }, 'Requirements: 8+ chars, uppercase, lowercase, number, special.')
      ),

      mode === 'signup' && e('div', { className:'captcha' },
        e('div', null, `Captcha: ${capA} + ${capB} =`),
        e('input', { style:{width:80}, value:capAnswer, onChange:e=>setCapAnswer(e.target.value), required:true })
      ),

      e('div', { style:{display:'flex', gap:8, marginTop:6} },
        e('button', { className:'btn primary', type:'submit' }, mode === 'login' ? 'Login' : 'Sign Up'),
        e('button', { className:'btn', type:'button', onClick: ()=>{ setMode(mode==='login'?'signup':'login'); setMsg(''); } },
          mode === 'login' ? 'Switch to Sign Up' : 'Switch to Login'
        )
      )
    ),
    e('div', { style:{marginTop:12} }, e('div', { className:'small' }, msg))
  );
}

// ----- EditorPage (with S3 upload, drafts, save/exit) -----
function EditorPage(){
  const [title,setTitle] = useState('');
  const [md,setMd] = useState('# Hello\n\nStart writing...');
  const [published,setPublished] = useState(false);
  const [status,setStatus] = useState('');
  const [posts,setPosts] = useState([]);
  const [selectedFile,setSelectedFile] = useState(null);
  const [currentEditingId,setCurrentEditingId] = useState(null);

  // load published posts
  useEffect(()=>{ fetchPosts(); fetchMyPosts(); }, []);

  async function fetchPosts(){
    try {
      const res = await fetch(apiBase + '/posts');
      const j = await res.json();
      if(Array.isArray(j)) setPosts(j);
    } catch(e){}
  }

  // fetch user posts/drafts (requires backend /api/me/posts)
  async function fetchMyPosts(){
    try {
      const res = await authFetch(apiBase + '/me/posts');
      const j = await res.json();
      if(Array.isArray(j)) {
        // put drafts to top and keep published below
        const sorted = j.sort((a,b)=> new Date(b.updatedAt) - new Date(a.updatedAt));
        setPosts(sorted);
      }
    } catch(e){}
  }

  // image upload flow:
  // 1) ask backend for presigned url: POST /api/upload-url { filename, contentType }
  // 2) PUT file to returned url
  // 3) use S3 public URL (or returned key) to insert markdown image link
  async function uploadAndInsertImage(file){
    if(!file) return;
    setStatus('Requesting upload URL...');
    try {
      const token = readToken();
      const res = await fetch(apiBase + '/upload-url', {
        method:'POST',
        headers: { 'Content-Type':'application/json', ...(token?{ 'Authorization': 'Bearer '+token }:{}) },
        body: JSON.stringify({ filename: file.name, contentType: file.type })
      });
      const j = await res.json();
      if(j.error){ setStatus('Upload URL error'); return; }
      const { url, key, publicUrl } = j; // backend must return these
      setStatus('Uploading to S3...');
      const put = await fetch(url, { method:'PUT', body: file, headers: { 'Content-Type': file.type } });
      if(!put.ok){ setStatus('Upload failed'); return; }
      // insert markdown image
      const imgMarkdown = `\n\n![${file.name}](${publicUrl})\n\n`;
      setMd(prev => prev + imgMarkdown);
      setStatus('Image uploaded');
    } catch(err){ setStatus('Upload error'); }
  }

  // Save post (create or update) - uses is_draft (published false => draft)
  async function savePost(e){
    e && e.preventDefault();
    setStatus('Saving...');
    const payload = { title, content: md, published: !!published };
    try {
      if(currentEditingId){
        // update existing
        const res = await authFetch(apiBase + '/posts/' + currentEditingId, {
          method:'PUT',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify(payload)
        });
        const j = await res.json();
        if(j.error) setStatus('Error: ' + j.error);
        else { setStatus('Saved ✓'); fetchPosts(); fetchMyPosts(); }
      } else {
        const res = await authFetch(apiBase + '/posts', {
          method:'POST',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify(payload)
        });
        const j = await res.json();
        if(j.error) setStatus('Error: ' + j.error);
        else { setStatus(payload.published ? 'Published ✓' : 'Saved draft ✓'); setCurrentEditingId(j.id); fetchPosts(); fetchMyPosts(); }
      }
    } catch(err){ setStatus('Network error'); }
  }

  // Load existing post into editor for editing
  async function loadPostForEdit(post){
    if(!post) return;
    setTitle(post.title);
    setMd(post.content);
    setPublished(!!post.published);
    setCurrentEditingId(post.id);
    goTo('/editor');
    setStatus('Loaded post for editing');
  }

  // quick new draft
  function newDraft(){
    setTitle(''); setMd('# New draft'); setPublished(false); setCurrentEditingId(null); setStatus('New draft');
  }

  return e('div', null,
    e('div', { className:'card' },
      e('div', { style:{display:'flex', justifyContent:'space-between', alignItems:'center'} },
        e('h2', null, currentEditingId ? 'Edit Post' : 'Compose'),
        e('div', null,
          e('button', { className:'btn', onClick: ()=>{ clearToken(); location.reload(); } }, 'Logout')
        )
      ),

      e('form', { onSubmit: savePost },
        e('div', { className:'form-row' },
          e('input', { placeholder:'Post title', value:title, onChange:e=>setTitle(e.target.value), required:true })
        ),

        e('div', { className:'layout' },
          e('div', { className:'editor' },
            e('textarea', { value: md, onChange: e=>setMd(e.target.value) })
          ),
          e('div', { className:'preview card' },
            e('h3', null, 'Preview'),
            e('div', { dangerouslySetInnerHTML: { __html: markedParser.parse(md) } })
          )
        ),

        e('div', { style:{display:'flex', gap:8, marginTop:12, alignItems:'center'} },
          e('label', { className:'small', style:{display:'flex',gap:8,alignItems:'center'} },
            e('input', { type:'checkbox', checked:published, onChange:e=>setPublished(e.target.checked) }), 'Publish'
          ),
          e('button', { className:'btn primary', type:'submit' }, currentEditingId ? 'Save Changes' : 'Save / Publish'),
          e('button', { className:'btn', type:'button', onClick: ()=>{ setPublished(false); savePost(); } }, 'Save & Exit'),
          e('button', { className:'btn', type:'button', onClick: newDraft }, 'New Draft')
        ),

        e('div', { style:{marginTop:12, display:'flex', gap:12, alignItems:'center'} },
          e('div', { className:'file-input' },
            e('input', { type:'file', onChange: (ev)=>{ setSelectedFile(ev.target.files[0]) } }),
            e('button', { className:'btn', type:'button', onClick: ()=>{ if(selectedFile) uploadAndInsertImage(selectedFile); } }, 'Upload Image')
          ),
          e('div', { className:'small' }, status)
        )
      )
    ),

    // My posts & drafts
    e('div', { className:'card' },
      e('h3', null, 'Your Posts & Drafts'),
      e('div', { className:'posts-list' },
        posts.length === 0 ? e('div', { className:'small' }, 'No posts yet') :
        posts.map(p => e('div', { key:p.id, className:'post-item' },
          e('div', null, e('strong', null, p.title), p.is_draft ? e('span', { style:{marginLeft:8, color:'#f59e0b'} }, ' (Draft)') : null),
          e('div', { className:'small' }, 'Updated: ' + new Date(p.updatedAt).toLocaleString()),
          e('div', { style:{marginTop:8, display:'flex', gap:8} },
            e('button', { className:'btn', onClick: ()=>loadPostForEdit(p) }, 'Edit'),
            e('button', { className:'btn', onClick: ()=>location.href = '/posts/' + p.slug }, 'Open')
          )
        ))
      )
    )
  );
}

// ----- Posts list (public) -----
function PostsPage(){
  const [posts,setPosts] = useState([]);
  useEffect(()=>{ fetch(apiBase + '/posts').then(r=>r.json()).then(setPosts).catch(()=>setPosts([])); }, []);
  return e('div', { className:'card' },
    e('h2', null, 'Public Posts'),
    posts.length === 0 ? e('div', { className:'small' }, 'No posts yet') :
    e('div', { className:'posts-list' }, posts.map(p => e('div', { key:p.id, className:'post-item' },
      e('div', null, e('strong', null, p.title)),
      e('div', { className:'small' }, 'By ' + (p.User ? (p.User.display_name || p.User.username) : 'Unknown')),
      e('div', { style:{marginTop:8} }, e('button', { className:'btn', onClick: ()=>location.href='/posts/'+p.slug }, 'Open'))
    )))
  );
}

// ----- PostOpen (redirect to server page) -----
function PostOpen({ slug }){
  useEffect(()=>{ location.href = '/posts/' + slug; }, [slug]);
  return e('div', { className:'card center' }, e('p', null, 'Opening post...'));
}

// ----- Render & nav wiring -----
function App(){ return e('div', null, e(Router)); }
ReactDOM.createRoot(document.getElementById('root')).render(e(App));

document.getElementById('nav-home').addEventListener('click', ()=>goTo('/'));
document.getElementById('nav-auth').addEventListener('click', ()=>goTo('/auth'));
document.getElementById('nav-editor').addEventListener('click', ()=>goTo('/editor'));
document.getElementById('nav-posts').addEventListener('click', ()=>goTo('/posts'));
if(!location.hash) location.hash = '/';

