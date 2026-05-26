import Link from 'next/link';

export const metadata = {
  title: 'قهوة — ادعم منشئك المفضل ☕',
  description: 'منصة كويتية لدعم المبدعين. ادفع بـ كي نت بالدينار. بدون حساب.',
};

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* nav */}
      <header className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <span className="text-2xl font-extrabold" style={{ fontFamily: 'Syne' }}>
          قهوة <span className="text-qahwa-accent">☕</span>
        </span>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="font-bold text-sm">تسجيل الدخول</Link>
          <Link href="/signup" className="q-btn-accent text-sm py-2 px-4">ابدأ مجاناً</Link>
        </nav>
      </header>

      {/* hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 max-w-3xl mx-auto">
        <div className="text-7xl mb-6">☕</div>
        <h1 className="text-4xl sm:text-6xl leading-tight mb-5">
          خلّي متابعينك
          <br />
          يشترونلك قهوة
        </h1>
        <p className="text-lg text-black/60 max-w-xl mb-9 font-medium">
          منصّة كويتية لدعم المبدعين. متابعينك يدعمونك بالدينار عبر كي نت —
          بدون حساب، بضغطة وحدة. ويوصلك إشعار واتساب بكل قهوة.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/signup" className="q-btn-accent text-lg px-7 py-4">
            أنشئ صفحتك ↗
          </Link>
          <Link href="/login" className="q-btn-white text-lg px-7 py-4">
            عندي حساب
          </Link>
        </div>
      </section>

      {/* feature strip */}
      <section className="max-w-4xl mx-auto w-full px-6 pb-20 grid sm:grid-cols-3 gap-4">
        {[
          ['💳', 'كي نت بالدينار', 'دفع محلي عبر MyFatoorah — كي نت، Apple Pay، فيزا.'],
          ['💬', 'إشعار واتساب', 'يوصلك إشعار بكل قهوة، وترد على داعمك مباشرة.'],
          ['🔒', 'بدون حساب للداعم', 'متابعك يدفع بضغطة وحدة، ما يحتاج تسجيل.'],
        ].map(([emoji, title, desc]) => (
          <div key={title} className="q-card p-5 text-right">
            <div className="text-3xl mb-2">{emoji}</div>
            <h3 className="text-lg mb-1">{title}</h3>
            <p className="text-sm text-black/60 font-medium">{desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t-2 border-qahwa-black/10 py-6 text-center text-sm text-black/40 font-medium">
        قهوة · صُنع في الكويت ☕
      </footer>
    </main>
  );
}
