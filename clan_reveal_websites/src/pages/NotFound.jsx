const LOGO = 'https://raw.githubusercontent.com/raindeer-sociaI/aarambh_images/refs/heads/main/rishihood_complete_logo.png'

export default function NotFound() {
  return (
    <div className="notfound">
      <div>
        <span className="logo-plate">
          <img src={LOGO} alt="Rishihood University" width="130" />
        </span>
        <h1 style={{ marginTop: 28 }}>This link has no clan</h1>
        <p>
          Use the exact &ldquo;Reveal My Clan&rdquo; button from your email &mdash; each
          one is unique. If it still does not work, write to{' '}
          <a href="mailto:learnerexperience@rishihood.edu.in" style={{ color: 'var(--crimson)', fontWeight: 700 }}>
            learnerexperience@rishihood.edu.in
          </a>.
        </p>
      </div>
    </div>
  )
}
