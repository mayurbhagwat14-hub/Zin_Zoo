import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Star, Loader2, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { userAPI } from "@food/api"

export default function AppFeedback() {
  const navigate = useNavigate()
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (rating === 0) {
      toast.error("Please select a rating before submitting")
      return
    }

    try {
      setSubmitting(true)
      const res = await userAPI.submitAppFeedback({
        rating,
        comment: comment.trim()
      })

      if (res.data?.success) {
        toast.success("Thank you for your feedback!")
        navigate("/profile")
      } else {
        toast.error("Failed to submit feedback")
      }
    } catch (error) {
      console.error("App feedback error:", error)
      toast.error(error.response?.data?.message || "Failed to submit feedback. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3 sticky top-0 z-20">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">App Feedback</h1>
      </div>

      <div className="flex-1 p-4 md:p-6 flex flex-col max-w-2xl mx-auto w-full">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-center text-gray-900 mb-2">
            How is your experience with our app?
          </h2>
          <p className="text-gray-500 text-center text-sm mb-8">
            Your feedback helps us improve and provide a better experience.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {/* Star Rating */}
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-2 transition-transform hover:scale-110 active:scale-95 focus:outline-none"
                >
                  <Star
                    className={`w-10 h-10 transition-colors ${
                      star <= (hoverRating || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Comment Section */}
            <div className="flex flex-col gap-2">
              <label htmlFor="feedback-comment" className="text-sm font-medium text-gray-700">
                Tell us more (Optional)
              </label>
              <textarea
                id="feedback-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What did you like or dislike?"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || rating === 0}
              className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 disabled:text-gray-500 transition-colors mt-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Feedback"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
