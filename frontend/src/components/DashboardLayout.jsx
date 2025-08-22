<main className="flex-1">
  {/* Top header like the screenshot */}
  <div className="px-6 pt-6 space-y-3">
    <div className="lcars-header-strip">
      <span className="text-2xl">EXTHOIDBOR</span>
      <span className="text-xl">UNITED FEDERATION OF PLANETS</span>
    </div>
    <div className="lcars-sep" />
  </div>

  {/* Dashboard body */}
  {tab === "network" ? (
    <img
      src={EnterpriseMap}
      alt="Ship Blueprint"
      className="absolute inset-0 w-full h-auto object-cover"
      draggable={false}
    />
  ) : (
    <div className="px-6 py-6">
      {/* 12-col grid to place panels roughly like the image */}
      <div className="grid grid-cols-12 gap-4">
        {/* LEFT COLUMN: big biometric block (col-span-5) */}
        <section className="col-span-12 md:col-span-5 space-y-4">
          <div className="lcars-panel">
            <div className="text-lg font-semibold mb-2">Crew Biometrics</div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span>On Duty</span><span>8</span></div>
              <div className="flex items-center justify-between"><span>Heart Rate</span><span>72</span></div>
              <LcarsMeter value={72} color="gold" />
              <div className="flex items-center justify-between"><span>Stress Index</span><span>0.4</span></div>
              <LcarsMeter value={40} color="copper" />
            </div>
          </div>

          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 md:col-span-7 lcars-panel">
              <div className="text-lg font-semibold mb-2">Impulse Engines</div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between"><span>Power</span><span>72%</span></div>
                <LcarsMeter value={72} />
                <div className="flex items-center justify-between"><span>Coil Temp</span><span>700°</span></div>
                <LcarsMeter value={70} color="copper" />
                <div className="flex items-center justify-between"><span>Efficiency</span><span>82%</span></div>
                <LcarsMeter value={82} color="gold" />
              </div>
            </div>
            <div className="col-span-12 md:col-span-5 lcars-panel">
              <div className="text-lg font-semibold mb-2">Torpedoes</div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between"><span>Load</span><span>0.8</span></div>
                <LcarsMeter value={80} color="copper" />
                <div className="flex items-center justify-between"><span>Subspace Contacts</span><span>2</span></div>
                <LcarsMeter value={20} color="slate" />
              </div>
            </div>
          </div>

          <div className="lcars-panel">
            <div className="text-lg font-semibold mb-2">Phasers</div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span>Charge</span><span>85%</span></div>
              <LcarsMeter value={85} color="gold" />
              <div className="flex items-center justify-between"><span>Emitter Temp</span><span>50%</span></div>
              <LcarsMeter value={50} color="amber" />
            </div>
          </div>
        </section>

        {/* MIDDLE COLUMN: shields + transporters + deflector (col-span-4) */}
        <section className="col-span-12 md:col-span-4 space-y-4">
          <div className="lcars-panel">
            <div className="text-lg font-semibold mb-2">Shields</div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span>Fore</span><span>88%</span></div>
              <LcarsMeter value={88} color="gold" />
              <div className="flex items-center justify-between"><span>Aft</span><span>88%</span></div>
              <LcarsMeter value={88} color="gold" />
              <div className="flex items-center justify-between"><span>Port</span><span>70%</span></div>
              <LcarsMeter value={70} color="amber" />
              <div className="flex items-center justify-between"><span>Harmonics</span><span>210.0 Hz</span></div>
            </div>
          </div>

          <div className="lcars-panel">
            <div className="text-lg font-semibold mb-2">Transporters</div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span>Pattern Buffer Load</span><span>—</span></div>
              <LcarsMeter value={35} color="copper" />
              <div className="flex items-center justify-between"><span>Cycle Time</span><span>4.5s</span></div>
              <LcarsMeter value={45} color="gold" />
            </div>
          </div>

          <div className="lcars-panel">
            <div className="text-lg font-semibold mb-2">Deflector</div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span>Field Strength</span><span>84%</span></div>
              <LcarsMeter value={84} color="blue" />
              <div className="flex items-center justify-between"><span>Resonance</span><span>6.0 Hz</span></div>
              <LcarsMeter value={60} color="blue" />
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: Red Alert + small status blocks (col-span-3) */}
        <section className="col-span-12 md:col-span-3 space-y-4">
          <div className="lcars-panel">
            <div className="h-12 rounded-lcars bg-lcars-red flex items-center justify-center text-black font-bold">
              RED ALERT
            </div>
            <div className="mt-3 flex gap-2">
              <div className="h-3 flex-1 bg-lcars-red/60 rounded-lcars" />
              <div className="h-3 flex-1 bg-lcars-red/60 rounded-lcars" />
            </div>
          </div>

          <div className="lcars-panel">
            <div className="text-lg font-semibold mb-2">Life Support</div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span>O₂</span><span>70.3%</span></div>
              <LcarsMeter value={70} color="blue" />
              <div className="flex items-center justify-between"><span>CO₂</span><span>350 ppm</span></div>
              <LcarsMeter value={35} color="slate" />
            </div>
          </div>

          <div className="lcars-panel">
            <div className="text-lg font-semibold mb-2">Shuttlecraft</div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between"><span>Galileo</span><span>POS A05.8.8”</span></div>
              <div className="flex items-center justify-between"><span>Speed</span><span>0.1 km/s</span></div>
              <div className="flex items-center justify-between"><span>Copernicus Fuel</span><span>70.5%</span></div>
              <LcarsMeter value={70} color="amber" />
            </div>
          </div>
        </section>
      </div>
    </div>
  )}
</main>
