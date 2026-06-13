import glob, sys

REGEX_PREV = set("(,;{[:?=!&|^~<>+-*%")

def strip_js(s):
    out = []
    i = 0
    n = len(s)
    # stack of contexts: 'code' (top) or template marker handled inline
    # we track template nesting with a stack of brace-depths
    tmpl_stack = []  # each item: brace depth at which template resumes
    prev_sig = ''     # last significant emitted char in code

    def in_template():
        return len(tmpl_stack) > 0 and tmpl_stack[-1] is not None and tmpl_stack[-1] == 'TMPL'

    # We'll use an explicit mode machine.
    mode = 'code'
    brace_depth = []  # for interpolation returns: list of depths
    while i < n:
        c = s[i]
        if mode == 'code':
            two = s[i:i+2]
            if two == '//':
                j = s.find('\n', i)
                if j == -1: j = n
                i = j
                continue
            if two == '/*':
                j = s.find('*/', i+2)
                if j == -1: j = n-2
                i = j+2
                continue
            if c == "'" or c == '"':
                q = c
                out.append(c); i += 1
                while i < n:
                    d = s[i]
                    out.append(d)
                    if d == '\\':
                        if i+1 < n: out.append(s[i+1]); i += 2; continue
                    if d == q:
                        i += 1; break
                    i += 1
                prev_sig = q
                continue
            if c == '`':
                out.append(c); i += 1
                # template literal
                while i < n:
                    d = s[i]
                    if d == '\\':
                        out.append(d)
                        if i+1 < n: out.append(s[i+1]); i += 2; continue
                        i += 1; continue
                    if d == '`':
                        out.append(d); i += 1; break
                    if d == '$' and i+1 < n and s[i+1] == '{':
                        out.append('${'); i += 2
                        # enter interpolation code until matching }
                        depth = 1
                        while i < n and depth > 0:
                            e = s[i]
                            t2 = s[i:i+2]
                            if t2 == '//':
                                j = s.find('\n', i); j = n if j==-1 else j; i = j; continue
                            if t2 == '/*':
                                j = s.find('*/', i+2); j = n-2 if j==-1 else j; i = j+2; continue
                            if e == "'" or e == '"':
                                q = e; out.append(e); i += 1
                                while i < n:
                                    f = s[i]; out.append(f)
                                    if f == '\\':
                                        if i+1<n: out.append(s[i+1]); i+=2; continue
                                    if f == q: i+=1; break
                                    i+=1
                                continue
                            if e == '`':
                                # nested template inside interpolation: recurse simply by reusing handler
                                out.append(e); i += 1
                                inner_depth_marker = True
                                # handle nested template
                                while i < n:
                                    g = s[i]
                                    if g == '\\':
                                        out.append(g)
                                        if i+1<n: out.append(s[i+1]); i+=2; continue
                                        i+=1; continue
                                    if g == '`':
                                        out.append(g); i+=1; break
                                    if g == '$' and i+1<n and s[i+1]=='{':
                                        out.append('${'); i+=2; d2=1
                                        while i<n and d2>0:
                                            h=s[i]
                                            if h=='{': d2+=1; out.append(h); i+=1; continue
                                            if h=='}': d2-=1; out.append(h); i+=1; continue
                                            if h=="'" or h=='"':
                                                q2=h; out.append(h); i+=1
                                                while i<n:
                                                    k=s[i]; out.append(k)
                                                    if k=='\\':
                                                        if i+1<n: out.append(s[i+1]); i+=2; continue
                                                    if k==q2: i+=1; break
                                                    i+=1
                                                continue
                                            out.append(h); i+=1
                                        continue
                                    out.append(g); i+=1
                                continue
                            if e == '{':
                                depth += 1; out.append(e); i += 1; continue
                            if e == '}':
                                depth -= 1; out.append(e); i += 1; continue
                            out.append(e); i += 1
                        continue
                    out.append(d); i += 1
                prev_sig = '`'
                continue
            if c == '/':
                # regex or divide
                if prev_sig in REGEX_PREV or prev_sig == '':
                    # regex literal
                    out.append('/'); i += 1
                    in_class = False
                    while i < n:
                        d = s[i]
                        out.append(d)
                        if d == '\\':
                            if i+1 < n: out.append(s[i+1]); i += 2; continue
                            i += 1; continue
                        if d == '[':
                            in_class = True
                        elif d == ']':
                            in_class = False
                        elif d == '/' and not in_class:
                            i += 1; break
                        i += 1
                    # consume flags
                    while i < n and s[i].isalpha():
                        out.append(s[i]); i += 1
                    prev_sig = '/'
                    continue
                else:
                    out.append('/'); i += 1; prev_sig = '/'; continue
            # default
            out.append(c)
            if not c.isspace():
                prev_sig = c
            i += 1
            continue
    return ''.join(out)

def cleanup_blank_lines(s):
    lines = s.split('\n')
    res = []
    for ln in lines:
        if ln.strip() == '':
            res.append('')
        else:
            res.append(ln.rstrip())
    # collapse 3+ blank lines to 1
    final = []
    blank = 0
    for ln in res:
        if ln == '':
            blank += 1
            if blank <= 1:
                final.append(ln)
        else:
            blank = 0
            final.append(ln)
    # strip leading/trailing blanks
    while final and final[0] == '': final.pop(0)
    while final and final[-1] == '': final.pop()
    return '\n'.join(final) + '\n'

for path in glob.glob('js/*.js'):
    src = open(path, encoding='utf-8').read()
    out = strip_js(src)
    out = cleanup_blank_lines(out)
    open(path, 'w', encoding='utf-8', newline='\n').write(out)
    print('stripped', path)
