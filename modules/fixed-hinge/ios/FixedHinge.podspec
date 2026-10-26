Pod::Spec.new do |s|
  s.name           = 'FixedHinge'
  s.version        = '1.0.0'
  s.summary        = 'Charnière de l\'iPhone Duo (iOS 27.1) : posture, pli, angle.'
  s.description    = s.summary
  s.license        = 'UNLICENSED'
  s.author         = 'FIXED'
  s.homepage       = 'https://thefixed.app'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,swift}'
end
