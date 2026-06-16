import Image from "next/image";
import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="bg-white border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/apple-touch-icon.png"
            alt="HouseData logo"
            width={34}
            height={34}
            className="rounded-lg"
          />
          <span className="font-bold text-lg text-gray-900 tracking-tight">
            HouseData<span className="text-blue-600">.us</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
