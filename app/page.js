import KVCacheLab from "./components/KVCacheLab";
import SalesListings from "./components/SalesListings";

export default function Home() {
  return (
    <main className="page-main">
      <SalesListings />
      <KVCacheLab />
    </main>
  );
}
