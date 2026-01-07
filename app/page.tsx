import { Suspense } from 'react'
import Nav from '@/components/landing/Nav'
import Hero from '@/components/landing/Hero'
import FeatureGrid from '@/components/landing/FeatureGrid'
import HowItWorks from '@/components/landing/HowItWorks'
import DailyHubPreview from '@/components/landing/DailyHubPreview'
import SocialProof from '@/components/landing/SocialProof'
import FAQ from '@/components/landing/FAQ'
import Footer from '@/components/landing/Footer'
import AuthRedirectHandler from '@/components/AuthRedirectHandler'

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <Suspense fallback={null}>
        <AuthRedirectHandler />
      </Suspense>
      <Nav />
      <Hero />
      <FeatureGrid />
      <HowItWorks />
      <DailyHubPreview />
      <SocialProof />
      <FAQ />
      <Footer />
    </main>
  )
}

